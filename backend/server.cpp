#include "ComplaintManager.h"

#include <algorithm>
#include <cctype>
#include <cstring>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <string>

#ifdef _WIN32
#define _WINSOCK_DEPRECATED_NO_WARNINGS
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
using SocketType = SOCKET;
constexpr SocketType INVALID_SOCK = INVALID_SOCKET;
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
using SocketType = int;
constexpr SocketType INVALID_SOCK = -1;
#endif

namespace {

void closeSocket(SocketType sock) {
#ifdef _WIN32
    closesocket(sock);
#else
    close(sock);
#endif
}

std::string trim(std::string s) {
    auto notSpace = [](unsigned char ch) { return !std::isspace(ch); };
    s.erase(s.begin(), std::find_if(s.begin(), s.end(), notSpace));
    s.erase(std::find_if(s.rbegin(), s.rend(), notSpace).base(), s.end());
    return s;
}

std::string decode(const std::string& value) {
    std::string out;
    out.reserve(value.size());
    auto hexVal = [](char c) -> int {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        if (c >= 'A' && c <= 'F') return c - 'A' + 10;
        return -1;
    };

    for (std::size_t i = 0; i < value.size(); ++i) {
        if (value[i] == '+') {
            out.push_back(' ');
        } else if (value[i] == '%' && i + 2 < value.size()) {
            int h1 = hexVal(value[i + 1]);
            int h2 = hexVal(value[i + 2]);
            if (h1 >= 0 && h2 >= 0) {
                out.push_back(static_cast<char>((h1 << 4) | h2));
                i += 2;
            } else {
                out.push_back(value[i]);
            }
        } else {
            out.push_back(value[i]);
        }
    }
    return out;
}

std::map<std::string, std::string> parseForm(const std::string& body) {
    std::map<std::string, std::string> result;
    std::stringstream ss(body);
    std::string pair;
    while (std::getline(ss, pair, '&')) {
        std::size_t eq = pair.find('=');
        if (eq != std::string::npos) {
            std::string key = decode(pair.substr(0, eq));
            std::string val = decode(pair.substr(eq + 1));
            result[key] = val;
        }
    }
    return result;
}

std::string jsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) >= 0x20) {
                    out.push_back(c);
                }
                break;
        }
    }
    return out;
}

std::string complaintsJson(const ComplaintManager& manager) {
    const auto& list = manager.getAll();
    std::ostringstream oss;
    oss << "[";
    for (std::size_t i = 0; i < list.size(); ++i) {
        const auto& c = list[i];
        if (i > 0) oss << ",";
        oss << "{"
            << "\"id\":" << c.id << ","
            << "\"studentName\":\"" << jsonEscape(c.studentName) << "\","
            << "\"rollNumber\":\"" << jsonEscape(c.rollNumber) << "\","
            << "\"roomNumber\":\"" << jsonEscape(c.roomNumber) << "\","
            << "\"category\":\"" << jsonEscape(c.category) << "\","
            << "\"priority\":\"" << jsonEscape(c.priority) << "\","
            << "\"description\":\"" << jsonEscape(c.description) << "\","
            << "\"status\":\"" << jsonEscape(c.status) << "\","
            << "\"createdAt\":\"" << jsonEscape(c.createdAt) << "\","
            << "\"updatedAt\":\"" << jsonEscape(c.updatedAt) << "\""
            << "}";
    }
    oss << "]";
    return oss.str();
}

std::string readFile(const std::string& path) {
    std::ifstream in(path, std::ios::binary);
    if (!in.is_open()) return "";
    std::ostringstream oss;
    oss << in.rdbuf();
    return oss.str();
}

void respond(SocketType client, int code, const std::string& contentType, const std::string& body) {
    std::string statusText = "OK";
    if (code == 201) statusText = "Created";
    else if (code == 400) statusText = "Bad Request";
    else if (code == 404) statusText = "Not Found";
    else if (code == 500) statusText = "Internal Server Error";

    std::ostringstream oss;
    oss << "HTTP/1.1 " << code << " " << statusText << "\r\n"
        << "Content-Type: " << contentType << "\r\n"
        << "Content-Length: " << body.size() << "\r\n"
        << "Access-Control-Allow-Origin: *\r\n"
        << "Connection: close\r\n"
        << "Cache-Control: no-store\r\n\r\n"
        << body;

    std::string response = oss.str();
    std::size_t totalSent = 0;
    while (totalSent < response.size()) {
        int sent = send(client, response.data() + totalSent,
                        static_cast<int>(response.size() - totalSent), 0);
        if (sent <= 0) break;
        totalSent += static_cast<std::size_t>(sent);
    }
}

bool safeText(const std::string& s) {
    return !s.empty() &&
           s.find('|') == std::string::npos &&
           s.find('\n') == std::string::npos &&
           s.find('\r') == std::string::npos;
}

void handle(SocketType client, ComplaintManager& manager) {
    std::string request;
    char buf[4096];
    std::size_t headerEnd = std::string::npos;
    std::size_t contentLength = 0;

    while (true) {
        int n = recv(client, buf, sizeof(buf), 0);
        if (n <= 0) break;
        request.append(buf, static_cast<std::size_t>(n));

        if (headerEnd == std::string::npos) {
            headerEnd = request.find("\r\n\r\n");
            if (headerEnd != std::string::npos) {
                std::string headersLower = request.substr(0, headerEnd);
                std::transform(headersLower.begin(), headersLower.end(), headersLower.begin(),
                               [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
                std::size_t clPos = headersLower.find("content-length:");
                if (clPos != std::string::npos) {
                    std::size_t lineEnd = headersLower.find("\r\n", clPos);
                    std::string val = trim(headersLower.substr(clPos + 15,
                                         lineEnd == std::string::npos ? std::string::npos : lineEnd - (clPos + 15)));
                    try {
                        contentLength = static_cast<std::size_t>(std::stoul(val));
                    } catch (...) {
                        contentLength = 0;
                    }
                }
            }
        }

        if (headerEnd != std::string::npos && request.size() >= headerEnd + 4 + contentLength) {
            break;
        }
        if (request.size() > 1024 * 1024) {
            break;
        }
    }

    if (request.empty()) {
        closeSocket(client);
        return;
    }

    std::size_t firstLineEnd = request.find("\r\n");
    std::string firstLine = request.substr(0, firstLineEnd);
    std::istringstream lineStream(firstLine);
    std::string method, rawPath;
    lineStream >> method >> rawPath;

    std::string path = rawPath;
    std::size_t qPos = path.find('?');
    if (qPos != std::string::npos) {
        path = path.substr(0, qPos);
    }

    std::string body = (headerEnd != std::string::npos) ? request.substr(headerEnd + 4) : "";

    if (method == "OPTIONS") {
        respond(client, 200, "text/plain; charset=utf-8", "");
    } else if (method == "GET" && path == "/api/complaints") {
        respond(client, 200, "application/json; charset=utf-8", complaintsJson(manager));
    } else if (method == "POST" && path == "/api/complaints") {
        auto form = parseForm(body);
        Complaint input;
        input.studentName = trim(form["studentName"]);
        input.rollNumber = trim(form["rollNumber"]);
        input.roomNumber = trim(form["roomNumber"]);
        input.category = trim(form["category"]);
        input.description = trim(form["description"]);

        if (!safeText(input.studentName) || !safeText(input.rollNumber) ||
            !safeText(input.roomNumber) || !safeText(input.category) ||
            !safeText(input.description)) {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"All fields including Room No. are required. Do not use | or line breaks.\"}");
        } else {
            Complaint created;
            if (manager.add(input, created)) {
                std::ostringstream res;
                res << "{\"message\":\"Complaint submitted\",\"id\":" << created.id
                    << ",\"roomNumber\":\"" << jsonEscape(created.roomNumber) << "\""
                    << ",\"priority\":\"" << jsonEscape(created.priority) << "\"}";
                respond(client, 201, "application/json; charset=utf-8", res.str());
            } else {
                respond(client, 500, "application/json; charset=utf-8",
                        "{\"error\":\"Could not save complaint\"}");
            }
        }
    } else if (method == "POST" && path == "/api/status") {
        auto form = parseForm(body);
        int id = 0;
        try {
            id = std::stoi(trim(form["id"]));
        } catch (...) {
            id = 0;
        }
        std::string status = trim(form["status"]);

        if (id > 0 && manager.updateStatus(id, status)) {
            respond(client, 200, "application/json; charset=utf-8",
                    "{\"message\":\"Status updated\"}");
        } else {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"Invalid complaint ID or status\"}");
        }
    } else if (method == "POST" && path == "/api/delete") {
        auto form = parseForm(body);
        int id = 0;
        try {
            id = std::stoi(trim(form["id"]));
        } catch (...) {
            id = 0;
        }

        if (id > 0 && manager.removeById(id)) {
            respond(client, 200, "application/json; charset=utf-8",
                    "{\"message\":\"Complaint deleted\"}");
        } else {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"Invalid complaint ID\"}");
        }
    } else if (method == "GET") {
        std::string fileName = (path == "/") ? "index.html" : path.substr(1);
        if (fileName.find("..") != std::string::npos) {
            respond(client, 404, "text/plain; charset=utf-8", "Not found");
            closeSocket(client);
            return;
        }

        std::string contentType = "text/plain; charset=utf-8";
        if (fileName.size() >= 5 && fileName.substr(fileName.size() - 5) == ".html") {
            contentType = "text/html; charset=utf-8";
        } else if (fileName.size() >= 4 && fileName.substr(fileName.size() - 4) == ".css") {
            contentType = "text/css; charset=utf-8";
        } else if (fileName.size() >= 3 && fileName.substr(fileName.size() - 3) == ".js") {
            contentType = "application/javascript; charset=utf-8";
        }

        std::string content = readFile("../frontend/" + fileName);
        if (content.empty()) {
            content = readFile("frontend/" + fileName);
        }

        if (!content.empty()) {
            respond(client, 200, contentType, content);
        } else {
            respond(client, 404, "text/plain; charset=utf-8",
                    "Frontend file not found. Run the server from the backend folder.");
        }
    } else {
        respond(client, 404, "application/json; charset=utf-8",
                "{\"error\":\"Route not found\"}");
    }

    closeSocket(client);
}

} // namespace

int main() {
#ifdef _WIN32
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        std::cerr << "Winsock startup failed\n";
        return 1;
    }
#endif

    SocketType serverSock = socket(AF_INET, SOCK_STREAM, 0);
    if (serverSock == INVALID_SOCK) {
        std::cerr << "Could not create socket\n";
#ifdef _WIN32
        WSACleanup();
#endif
        return 1;
    }

    int opt = 1;
    setsockopt(serverSock, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&opt), sizeof(opt));

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons(8080);

    if (bind(serverSock, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
        std::cerr << "Could not start server on port 8080. Is the port already in use?\n";
        closeSocket(serverSock);
#ifdef _WIN32
        WSACleanup();
#endif
        return 1;
    }

    if (listen(serverSock, 16) < 0) {
        std::cerr << "Listen failed\n";
        closeSocket(serverSock);
#ifdef _WIN32
        WSACleanup();
#endif
        return 1;
    }

    ComplaintManager manager("complaints.txt");
    std::cout << "Campus Complaint Portal (v2.1) running at http://localhost:8080\n"
              << "Press Ctrl+C to stop.\n";

    while (true) {
        sockaddr_in clientAddr{};
#ifdef _WIN32
        int clientLen = sizeof(clientAddr);
#else
        socklen_t clientLen = sizeof(clientAddr);
#endif
        SocketType client = accept(serverSock, reinterpret_cast<sockaddr*>(&clientAddr), &clientLen);
        if (client == INVALID_SOCK) continue;
        handle(client, manager);
    }

    closeSocket(serverSock);
#ifdef _WIN32
    WSACleanup();
#endif
    return 0;
}
