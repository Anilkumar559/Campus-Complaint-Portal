#include "ComplaintManager.h"
#include <algorithm>
#include <cctype>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <string>

#ifdef _WIN32
#define NOMINMAX
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "Ws2_32.lib")
using Socket = SOCKET;
static void closeSocket(Socket s) { closesocket(s); }
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
using Socket = int;
static void closeSocket(Socket s) { close(s); }
#endif

static std::string trim(std::string s) {
    while (!s.empty() && (s.back() == '\r' || s.back() == ' ' || s.back() == '\t')) s.pop_back();
    size_t i = 0; while (i < s.size() && (s[i] == ' ' || s[i] == '\t')) ++i;
    return s.substr(i);
}
static std::string decode(const std::string& s) {
    std::string out;
    for (size_t i = 0; i < s.size(); ++i) {
        if (s[i] == '+') out += ' ';
        else if (s[i] == '%' && i + 2 < s.size()) {
            auto hex = [](char c) -> int { if (c >= '0' && c <= '9') return c-'0'; if (c >= 'a' && c <= 'f') return c-'a'+10; if (c >= 'A' && c <= 'F') return c-'A'+10; return -1; };
            int a = hex(s[i+1]), b = hex(s[i+2]);
            if (a >= 0 && b >= 0) { out += static_cast<char>(a * 16 + b); i += 2; } else out += s[i];
        } else out += s[i];
    }
    return out;
}
static std::map<std::string, std::string> parseForm(const std::string& body) {
    std::map<std::string, std::string> values;
    std::stringstream ss(body); std::string part;
    while (std::getline(ss, part, '&')) {
        size_t eq = part.find('=');
        std::string key = decode(part.substr(0, eq));
        std::string value = eq == std::string::npos ? "" : decode(part.substr(eq + 1));
        values[key] = value;
    }
    return values;
}
static std::string jsonEscape(const std::string& s) {
    std::string out;
    for (unsigned char c : s) {
        switch (c) { case '"': out += "\\\""; break; case '\\': out += "\\\\"; break;
        case '\n': out += "\\n"; break; case '\r': out += "\\r"; break; case '\t': out += "\\t"; break;
        default: if (c < 32) out += ' '; else out += static_cast<char>(c); }
    }
    return out;
}
static std::string complaintsJson(const ComplaintManager& manager) {
    std::ostringstream out; out << "["; bool first = true;
    for (const auto& c : manager.getAll()) {
        if (!first) out << ","; first = false;
        out << "{\"id\":" << c.id << ",\"studentName\":\"" << jsonEscape(c.studentName)
            << "\",\"rollNumber\":\"" << jsonEscape(c.rollNumber) << "\",\"category\":\""
            << jsonEscape(c.category) << "\",\"description\":\"" << jsonEscape(c.description)
            << "\",\"status\":\"" << jsonEscape(c.status) << "\"}";
    }
    out << "]"; return out.str();
}
static std::string readFile(const std::string& path) {
    std::ifstream in(path, std::ios::binary);
    if (!in) return "";
    std::ostringstream ss; ss << in.rdbuf(); return ss.str();
}
static void respond(Socket client, int status, const std::string& contentType, const std::string& body) {
    std::string label = status == 200 ? "OK" : status == 201 ? "Created" : status == 400 ? "Bad Request" : status == 404 ? "Not Found" : "Internal Server Error";
    std::ostringstream head;
    head << "HTTP/1.1 " << status << " " << label << "\r\nContent-Type: " << contentType
         << "\r\nContent-Length: " << body.size() << "\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n";
    std::string response = head.str() + body;
    size_t sent = 0;
    while (sent < response.size()) {
#ifdef _WIN32
        int n = send(client, response.data() + sent, static_cast<int>(response.size() - sent), 0);
#else
        ssize_t n = send(client, response.data() + sent, response.size() - sent, 0);
#endif
        if (n <= 0) break; sent += static_cast<size_t>(n);
    }
}
static bool safeText(const std::string& s) {
    return s.find('|') == std::string::npos && s.find('\n') == std::string::npos && s.find('\r') == std::string::npos;
}
static void handle(Socket client, ComplaintManager& manager) {
    std::string raw; char buffer[4096]; size_t headerEnd = std::string::npos; size_t contentLength = 0;
    while ((headerEnd = raw.find("\r\n\r\n")) == std::string::npos) {
#ifdef _WIN32
        int n = recv(client, buffer, sizeof(buffer), 0);
#else
        ssize_t n = recv(client, buffer, sizeof(buffer), 0);
#endif
        if (n <= 0) { closeSocket(client); return; }
        raw.append(buffer, static_cast<size_t>(n));
        if (raw.size() > 1024 * 1024) { closeSocket(client); return; }
    }
    std::string headers = raw.substr(0, headerEnd);
    std::istringstream hs(headers); std::string method, target, version; hs >> method >> target >> version;
    std::string line; std::getline(hs, line);
    while (std::getline(hs, line)) {
        line = trim(line); size_t colon = line.find(':');
        if (colon != std::string::npos) {
            std::string key = line.substr(0, colon); std::transform(key.begin(), key.end(), key.begin(), [](unsigned char c){ return static_cast<char>(std::tolower(c)); });
            if (key == "content-length") { try { contentLength = static_cast<size_t>(std::stoul(trim(line.substr(colon + 1)))); } catch (...) {} }
        }
    }
    const size_t bodyStart = headerEnd + 4;
    while (raw.size() < bodyStart + contentLength) {
#ifdef _WIN32
        int n = recv(client, buffer, sizeof(buffer), 0);
#else
        ssize_t n = recv(client, buffer, sizeof(buffer), 0);
#endif
        if (n <= 0) break; raw.append(buffer, static_cast<size_t>(n));
    }
    std::string body = raw.size() >= bodyStart ? raw.substr(bodyStart, contentLength) : "";
    size_t q = target.find('?'); std::string path = target.substr(0, q);
    if (method == "GET" && path == "/api/complaints") {
        respond(client, 200, "application/json; charset=utf-8", complaintsJson(manager));
    } else if (method == "POST" && path == "/api/complaints") {
        auto f = parseForm(body); Complaint c, created;
        c.studentName = f["studentName"]; c.rollNumber = f["rollNumber"]; c.category = f["category"]; c.description = f["description"];
        if (c.studentName.empty() || c.rollNumber.empty() || c.category.empty() || c.description.empty() ||
            !safeText(c.studentName) || !safeText(c.rollNumber) || !safeText(c.category) || !safeText(c.description)) {
            respond(client, 400, "application/json; charset=utf-8", "{\"error\":\"All fields are required. Do not use the | character or line breaks.\"}");
        } else if (manager.add(c, created)) {
            respond(client, 201, "application/json; charset=utf-8", "{\"message\":\"Complaint submitted\",\"id\":" + std::to_string(created.id) + "}");
        } else respond(client, 500, "application/json; charset=utf-8", "{\"error\":\"Could not save complaint\"}");
    } else if (method == "POST" && path == "/api/status") {
        auto f = parseForm(body); int id = 0;
        try { id = std::stoi(f["id"]); } catch (...) {}
        if (manager.updateStatus(id, f["status"])) respond(client, 200, "application/json; charset=utf-8", "{\"message\":\"Status updated\"}");
        else respond(client, 400, "application/json; charset=utf-8", "{\"error\":\"Invalid complaint ID or status\"}");
    } else if (method == "GET") {
        std::string file = path == "/" ? "index.html" : path.substr(1);
        if (file.find("..") != std::string::npos || (file != "index.html" && file != "style.css" && file != "script.js")) {
            respond(client, 404, "text/plain; charset=utf-8", "Not found");
        } else {
            std::string data = readFile("../frontend/" + file);
            if (data.empty()) data = readFile("frontend/" + file);
            if (data.empty()) respond(client, 404, "text/plain; charset=utf-8", "Frontend file not found. Run the server from the backend folder.");
            else {
                std::string type = file == "index.html" ? "text/html; charset=utf-8" : file == "style.css" ? "text/css; charset=utf-8" : "application/javascript; charset=utf-8";
                respond(client, 200, type, data);
            }
        }
    } else respond(client, 404, "application/json; charset=utf-8", "{\"error\":\"Route not found\"}");
    closeSocket(client);
}

int main() {
#ifdef _WIN32
    WSADATA wsa; if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) { std::cerr << "Winsock startup failed\n"; return 1; }
#endif
    Socket server = socket(AF_INET, SOCK_STREAM, 0);
#ifdef _WIN32
    if (server == INVALID_SOCKET) { std::cerr << "Could not create socket\n"; WSACleanup(); return 1; }
    BOOL reuse = TRUE; setsockopt(server, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&reuse), sizeof(reuse));
#else
    if (server < 0) { std::cerr << "Could not create socket\n"; return 1; }
    int reuse = 1; setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));
#endif
    sockaddr_in address{}; address.sin_family = AF_INET; address.sin_addr.s_addr = htonl(INADDR_ANY); address.sin_port = htons(8080);
    if (bind(server, reinterpret_cast<sockaddr*>(&address), sizeof(address)) < 0 || listen(server, 10) < 0) {
        std::cerr << "Could not start server on port 8080. Is the port already in use?\n"; closeSocket(server);
#ifdef _WIN32
        WSACleanup();
#endif
        return 1;
    }
    ComplaintManager manager("complaints.txt");
    std::cout << "Campus Complaint Portal running at http://localhost:8080\nPress Ctrl+C to stop.\n";
    while (true) {
        sockaddr_in clientAddress{};
#ifdef _WIN32
        int len = sizeof(clientAddress); Socket client = accept(server, reinterpret_cast<sockaddr*>(&clientAddress), &len);
        if (client == INVALID_SOCKET) continue;
#else
        socklen_t len = sizeof(clientAddress); Socket client = accept(server, reinterpret_cast<sockaddr*>(&clientAddress), &len);
        if (client < 0) continue;
#endif
        handle(client, manager);
    }
    closeSocket(server);
#ifdef _WIN32
    WSACleanup();
#endif
    return 0;
}
