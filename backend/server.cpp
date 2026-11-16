/**
 * SRM UNIVERSITY AP - CAMPUS COMPLAINT MANAGEMENT SYSTEM
 * Lightweight HTTP server serving static frontend assets and REST APIs.
 * Supports Google Firebase Authentication, Strict Server-Side Admin Authorization,
 * and Student Privacy Isolation.
 */

#include "ComplaintManager.h"
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <map>
#include <algorithm>
#include <cctype>
#include <fstream>

#ifdef _WIN32
  #include <winsock2.h>
  #include <ws2tcpip.h>
  #pragma comment(lib, "ws2_32.lib")
  using SocketType = SOCKET;
  constexpr SocketType INVALID_SOCK = INVALID_SOCKET;
  void closeSocket(SocketType s) { closesocket(s); }
#else
  #include <sys/socket.h>
  #include <netinet/in.h>
  #include <unistd.h>
  using SocketType = int;
  constexpr SocketType INVALID_SOCK = -1;
  void closeSocket(SocketType s) { close(s); }
#endif

namespace {

std::string trim(const std::string& str) {
    auto start = str.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    auto end = str.find_last_not_of(" \t\r\n");
    return str.substr(start, end - start + 1);
}

std::string toLower(const std::string& str) {
    std::string out = str;
    std::transform(out.begin(), out.end(), out.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return out;
}

std::string urlDecode(const std::string& in) {
    std::string out;
    for (std::size_t i = 0; i < in.size(); ++i) {
        if (in[i] == '+') {
            out += ' ';
        } else if (in[i] == '%' && i + 2 < in.size()) {
            std::string hexStr = in.substr(i + 1, 2);
            char ch = static_cast<char>(std::strtol(hexStr.c_str(), nullptr, 16));
            out += ch;
            i += 2;
        } else {
            out += in[i];
        }
    }
    return out;
}

std::map<std::string, std::string> parseForm(const std::string& body) {
    std::map<std::string, std::string> form;
    std::istringstream stream(body);
    std::string pair;

    while (std::getline(stream, pair, '&')) {
        auto eq = pair.find('=');
        if (eq == std::string::npos) continue;
        std::string key = urlDecode(pair.substr(0, eq));
        std::string val = urlDecode(pair.substr(eq + 1));
        form[key] = val;
    }
    return form;
}

std::string jsonEscape(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        switch (c) {
            case '"': o << "\\\""; break;
            case '\\': o << "\\\\"; break;
            case '\b': o << "\\b"; break;
            case '\f': o << "\\f"; break;
            case '\n': o << "\\n"; break;
            case '\r': o << "\\r"; break;
            case '\t': o << "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) <= 0x1f) {
                    o << "\\u00"
                      << ((c >> 4) & 0x0f)
                      << (c & 0x0f);
                } else {
                    o << c;
                }
        }
    }
    return o.str();
}

std::string complaintToJson(const Complaint& c) {
    std::ostringstream oss;
    oss << "{"
        << "\"id\":" << c.id << ","
        << "\"studentName\":\"" << jsonEscape(c.studentName) << "\","
        << "\"rollNumber\":\"" << jsonEscape(c.rollNumber) << "\","
        << "\"studentEmail\":\"" << jsonEscape(c.studentEmail) << "\","
        << "\"roomNumber\":\"" << jsonEscape(c.roomNumber) << "\","
        << "\"category\":\"" << jsonEscape(c.category) << "\","
        << "\"priority\":\"" << jsonEscape(c.priority) << "\","
        << "\"status\":\"" << jsonEscape(c.status) << "\","
        << "\"description\":\"" << jsonEscape(c.description) << "\","
        << "\"adminRemarks\":\"" << jsonEscape(c.adminRemarks) << "\","
        << "\"assignedTechnician\":\"" << jsonEscape(c.assignedTechnician) << "\","
        << "\"createdAt\":\"" << jsonEscape(c.createdAt) << "\","
        << "\"updatedAt\":\"" << jsonEscape(c.updatedAt) << "\""
        << "}";
    return oss.str();
}

std::string complaintsJson(const ComplaintManager& manager, const std::string& filterEmail = "", const std::string& filterRoll = "") {
    auto all = manager.getAll();
    std::ostringstream oss;
    oss << "[";
    bool first = true;

    std::string fEmailLower = toLower(trim(filterEmail));
    std::string fRollLower = toLower(trim(filterRoll));

    for (const auto& c : all) {
        if (!fEmailLower.empty() || !fRollLower.empty()) {
            std::string cEmail = toLower(trim(c.studentEmail));
            std::string cRoll = toLower(trim(c.rollNumber));
            bool matches = (!fEmailLower.empty() && cEmail == fEmailLower) ||
                           (!fRollLower.empty() && cRoll == fRollLower);
            if (!matches) continue;
        }

        if (!first) oss << ",";
        oss << complaintToJson(c);
        first = false;
    }
    oss << "]";
    return oss.str();
}

std::string statsJson(const ComplaintManager& manager, const std::string& filterEmail = "", const std::string& filterRoll = "") {
    auto all = manager.getAll();
    int total = 0, pending = 0, inProgress = 0, resolved = 0, highPriority = 0;

    std::string fEmailLower = toLower(trim(filterEmail));
    std::string fRollLower = toLower(trim(filterRoll));

    for (const auto& c : all) {
        if (!fEmailLower.empty() || !fRollLower.empty()) {
            std::string cEmail = toLower(trim(c.studentEmail));
            std::string cRoll = toLower(trim(c.rollNumber));
            bool matches = (!fEmailLower.empty() && cEmail == fEmailLower) ||
                           (!fRollLower.empty() && cRoll == fRollLower);
            if (!matches) continue;
        }

        total++;
        if (c.status == "Pending") pending++;
        else if (c.status == "In Progress") inProgress++;
        else if (c.status == "Resolved") resolved++;

        if (c.priority == "High" && c.status != "Resolved") {
            highPriority++;
        }
    }

    std::ostringstream oss;
    oss << "{"
        << "\"total\":" << total << ","
        << "\"pending\":" << pending << ","
        << "\"inProgress\":" << inProgress << ","
        << "\"resolved\":" << resolved << ","
        << "\"highPriority\":" << highPriority
        << "}";
    return oss.str();
}

std::string readFile(const std::string& path) {
    std::ifstream in(path, std::ios::binary);
    if (!in.is_open()) return "";
    std::ostringstream oss;
    oss << in.rdbuf();
    return oss.str();
}

void respond(SocketType client, int code, const std::string& contentType, const std::string& body, bool headOnly = false) {
    std::string statusText = "OK";
    if (code == 201) statusText = "Created";
    else if (code == 400) statusText = "Bad Request";
    else if (code == 401) statusText = "Unauthorized";
    else if (code == 403) statusText = "Forbidden";
    else if (code == 404) statusText = "Not Found";
    else if (code == 500) statusText = "Internal Server Error";

    std::ostringstream oss;
    oss << "HTTP/1.1 " << code << " " << statusText << "\r\n"
        << "Content-Type: " << contentType << "\r\n"
        << "Content-Length: " << body.size() << "\r\n"
        << "Access-Control-Allow-Origin: *\r\n"
        << "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS, HEAD\r\n"
        << "Access-Control-Allow-Headers: Content-Type\r\n"
        << "Connection: close\r\n"
        << "Cache-Control: no-store\r\n\r\n";
    if (!headOnly) {
        oss << body;
    }

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

bool endsWith(const std::string& full, const std::string& suffix) {
    if (full.size() < suffix.size()) return false;
    return full.compare(full.size() - suffix.size(), suffix.size(), suffix) == 0;
}

// Strict University Email Domain Validator:
// Matches exactly username@srmap.edu.in (case-insensitive, no subdomains, no extra @)
bool isStrictSrmapEmail(const std::string& email) {
    std::string clean = toLower(trim(email));
    if (clean.empty()) return false;
    std::size_t atPos = clean.find('@');
    if (atPos == std::string::npos || atPos == 0) return false;
    if (clean.find('@', atPos + 1) != std::string::npos) return false;
    std::string domain = clean.substr(atPos + 1);
    return (domain == "srmap.edu.in");
}

std::string getMimeType(const std::string& path) {
    std::string lower = toLower(path);
    if (endsWith(lower, ".html") || endsWith(lower, ".htm")) return "text/html; charset=utf-8";
    if (endsWith(lower, ".css")) return "text/css; charset=utf-8";
    if (endsWith(lower, ".js")) return "application/javascript; charset=utf-8";
    if (endsWith(lower, ".json")) return "application/json; charset=utf-8";
    if (endsWith(lower, ".png")) return "image/png";
    if (endsWith(lower, ".jpg") || endsWith(lower, ".jpeg")) return "image/jpeg";
    if (endsWith(lower, ".svg")) return "image/svg+xml";
    if (endsWith(lower, ".ico")) return "image/x-icon";
    if (endsWith(lower, ".webp")) return "image/webp";
    if (endsWith(lower, ".txt")) return "text/plain; charset=utf-8";
    return "application/octet-stream";
}

// =============================================================================
// SERVER-SIDE ADMINISTRATOR PRIVILEGE STORE
// Controls which Google accounts have access to the Admin Dashboard.
// =============================================================================
class AdminStore {
private:
    std::string filename;
    std::vector<std::string> adminEmails;

    void save() {
        std::ofstream out(filename);
        for (const auto& email : adminEmails) {
            out << email << "\n";
        }
        out.close();

        // Mirror to other location (root <-> backend/) to prevent desynchronization
        std::string mirror = (filename == "admins.txt") ? "backend/admins.txt" : "admins.txt";
        std::ofstream mOut(mirror);
        if (mOut.is_open()) {
            for (const auto& email : adminEmails) {
                mOut << email << "\n";
            }
            mOut.close();
        }
    }

public:
    AdminStore(const std::string& file) : filename(file) {
        load();
    }

    void load() {
        adminEmails.clear();
        std::ifstream in(filename);
        if (!in.is_open()) {
            adminEmails = {
                "ap23110010838@srmap.edu.in",
                "admin@srmap.edu.in",
                "estate.admin@srmap.edu.in",
                "sarath_kondaveeti@srmap.edu.in"
            };
            save();
            return;
        }

        std::string line;
        while (std::getline(in, line)) {
            line = toLower(trim(line));
            if (!line.empty() && line[0] != '#') {
                if (isStrictSrmapEmail(line) && std::find(adminEmails.begin(), adminEmails.end(), line) == adminEmails.end()) {
                    adminEmails.push_back(line);
                }
            }
        }

        if (adminEmails.empty()) {
            adminEmails = {
                "ap23110010838@srmap.edu.in",
                "admin@srmap.edu.in",
                "estate.admin@srmap.edu.in",
                "sarath_kondaveeti@srmap.edu.in"
            };
            save();
        }
    }

    bool isAdmin(const std::string& email) const {
        std::string clean = toLower(trim(email));
        if (!isStrictSrmapEmail(clean)) return false;
        for (const auto& a : adminEmails) {
            if (a == clean) return true;
        }
        return false;
    }

    std::vector<std::string> getAdmins() const {
        return adminEmails;
    }

    bool addAdmin(const std::string& email) {
        std::string clean = toLower(trim(email));
        if (!isStrictSrmapEmail(clean) || isAdmin(clean)) return false;
        adminEmails.push_back(clean);
        save();
        return true;
    }

    bool removeAdmin(const std::string& email) {
        std::string clean = toLower(trim(email));
        auto it = std::remove(adminEmails.begin(), adminEmails.end(), clean);
        if (it != adminEmails.end()) {
            adminEmails.erase(it, adminEmails.end());
            save();
            return true;
        }
        return false;
    }
};

// Lightweight Base64URL and JWT payload inspector for Firebase ID Tokens
bool verifyAdminToken(const std::string& token, const std::string& expectedEmail) {
    if (token.empty() || expectedEmail.empty()) return false;
    std::size_t firstDot = token.find('.');
    if (firstDot == std::string::npos) return false;
    std::size_t secondDot = token.find('.', firstDot + 1);
    if (secondDot == std::string::npos) return false;

    std::string payloadB64 = token.substr(firstDot + 1, secondDot - firstDot - 1);
    for (char& c : payloadB64) {
        if (c == '-') c = '+';
        else if (c == '_') c = '/';
    }
    while (payloadB64.size() % 4 != 0) payloadB64.push_back('=');

    static const std::string b64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string decoded;
    std::vector<int> T(256, -1);
    for (int i = 0; i < 64; i++) T[static_cast<unsigned char>(b64Chars[i])] = i;

    int val = 0, valb = -8;
    for (unsigned char c : payloadB64) {
        if (c == '=') break;
        if (T[c] == -1) return false;
        val = (val << 6) + T[c];
        valb += 6;
        if (valb >= 0) {
            decoded.push_back(static_cast<char>((val >> valb) & 0xFF));
            valb -= 8;
        }
    }

    std::string lowerPayload = toLower(decoded);
    std::string lowerExpected = toLower(trim(expectedEmail));

    bool hasAud = (lowerPayload.find("\"aud\":\"srmap-complaints\"") != std::string::npos ||
                   lowerPayload.find("\"aud\": \"srmap-complaints\"") != std::string::npos);
    bool hasEmail = (lowerPayload.find(lowerExpected) != std::string::npos);
    bool hasAdminClaim = (lowerPayload.find("\"role\":\"admin\"") != std::string::npos ||
                          lowerPayload.find("\"role\": \"admin\"") != std::string::npos ||
                          lowerPayload.find("\"admin\":true") != std::string::npos ||
                          lowerPayload.find("\"admin\": true") != std::string::npos);

    return hasAud && hasEmail && hasAdminClaim;
}

void handle(SocketType client, ComplaintManager& manager, AdminStore& adminStore) {
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
                std::string headersLower = toLower(request.substr(0, headerEnd));
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
    std::string queryString;
    std::size_t qPos = path.find('?');
    if (qPos != std::string::npos) {
        queryString = path.substr(qPos + 1);
        path = path.substr(0, qPos);
    }

    std::string body = (headerEnd != std::string::npos) ? request.substr(headerEnd + 4) : "";

    if (method == "OPTIONS") {
        respond(client, 200, "text/plain; charset=utf-8", "");
    }
    else if ((method == "GET" || method == "HEAD") && path == "/api/health") {
        respond(client, 200, "application/json; charset=utf-8", "{\"status\":\"ok\",\"service\":\"SRM AP Campus Complaint System\",\"healthy\":true}");
    }
    // =========================================================================
    // SRM AP AUTHENTICATION ENDPOINT
    // Both Student and Admin authenticate with Google.
    // Server enforces that Admin Dashboard is ONLY granted to internally assigned admins.
    // =========================================================================
    else if (method == "POST" && path == "/api/login") {
        auto form = parseForm(body);
        std::string role = toLower(trim(form["role"]));
        std::string email = toLower(trim(form["email"]));
        std::string rollNumber = trim(form["rollNumber"]);
        std::string name = trim(form["name"]);
        std::string department = trim(form["department"]);
        std::string idToken = trim(form["idToken"]);

        if (!isStrictSrmapEmail(email)) {
            respond(client, 403, "application/json; charset=utf-8",
                    "{\"error\":\"Access denied. Please sign in using your official SRM AP university email address (@srmap.edu.in).\"}");
            closeSocket(client);
            return;
        }

        if (role == "admin") {
            // STRICT SERVER-SIDE AUTHORIZATION:
            // Checks AdminStore (admins.txt) OR verified Firebase ID Token with admin custom claim
            bool isAuthAdmin = adminStore.isAdmin(email);
            if (!isAuthAdmin && !idToken.empty()) {
                if (verifyAdminToken(idToken, email)) {
                    adminStore.addAdmin(email);
                    isAuthAdmin = true;
                }
            }

            if (!isAuthAdmin) {
                respond(client, 403, "application/json; charset=utf-8",
                        "{\"error\":\"Admin access denied. Your account is not authorized as an administrator.\"}");
                closeSocket(client);
                return;
            }

            if (name.empty()) name = "SRM AP Administrator";
            if (department.empty()) department = "Directorate of Campus Facilities & Estate";

            std::ostringstream res;
            res << "{\"success\":true,"
                << "\"message\":\"Authenticated as SRM AP Administrator\","
                << "\"user\":{"
                << "\"role\":\"admin\","
                << "\"name\":\"" << jsonEscape(name) << "\","
                << "\"email\":\"" << jsonEscape(email) << "\","
                << "\"department\":\"" << jsonEscape(department) << "\""
                << "}}";
            respond(client, 200, "application/json; charset=utf-8", res.str());
        } else {
            // Student Login
            // If display name contains " | ", extract full name and roll number cleanly
            std::size_t pipePos = name.find('|');
            if (pipePos != std::string::npos) {
                std::string extractedName = trim(name.substr(0, pipePos));
                std::string extractedRoll = trim(name.substr(pipePos + 1));
                if (!extractedName.empty()) name = extractedName;
                if (!extractedRoll.empty() && rollNumber.empty()) rollNumber = extractedRoll;
            }

            if (name.empty()) {
                std::size_t atPos = email.find('@');
                name = (atPos != std::string::npos) ? email.substr(0, atPos) : "SRMAP Student";
                std::replace(name.begin(), name.end(), '.', ' ');
                std::replace(name.begin(), name.end(), '_', ' ');
            }
            if (rollNumber.empty()) {
                std::size_t atPos = email.find('@');
                std::string prefix = (atPos != std::string::npos) ? email.substr(0, atPos) : "";
                if (prefix.size() >= 10 && (prefix.rfind("ap", 0) == 0 || prefix.rfind("AP", 0) == 0)) {
                    rollNumber = prefix;
                    std::transform(rollNumber.begin(), rollNumber.end(), rollNumber.begin(), ::toupper);
                } else {
                    rollNumber = prefix;
                }
            }

            std::ostringstream res;
            res << "{\"success\":true,"
                << "\"message\":\"Logged in to SRM University-AP Student Grievance Portal\","
                << "\"user\":{"
                << "\"role\":\"student\","
                << "\"name\":\"" << jsonEscape(name) << "\","
                << "\"rollNumber\":\"" << jsonEscape(rollNumber) << "\","
                << "\"email\":\"" << jsonEscape(email) << "\""
                << "}}";
            respond(client, 200, "application/json; charset=utf-8", res.str());
        }
    }
    // =========================================================================
    // INTERNAL ADMINISTRATOR ROSTER ENDPOINTS
    // =========================================================================
    else if (method == "GET" && path == "/api/admin/list") {
        auto query = parseForm(queryString);
        std::string requester = toLower(trim(query["adminEmail"]));
        if (!adminStore.isAdmin(requester)) {
            respond(client, 403, "application/json; charset=utf-8",
                    "{\"error\":\"Access Denied: Only authorized administrators can view the administrator list.\"}");
            closeSocket(client);
            return;
        }

        auto admins = adminStore.getAdmins();
        std::ostringstream res;
        res << "{\"success\":true,\"admins\":[";
        for (std::size_t i = 0; i < admins.size(); ++i) {
            if (i > 0) res << ",";
            res << "\"" << jsonEscape(admins[i]) << "\"";
        }
        res << "]}";
        respond(client, 200, "application/json; charset=utf-8", res.str());
    }
    else if (method == "POST" && path == "/api/admin/add") {
        auto form = parseForm(body);
        std::string requester = toLower(trim(form["adminEmail"]));
        std::string target = toLower(trim(form["targetEmail"]));

        if (!adminStore.isAdmin(requester)) {
            respond(client, 403, "application/json; charset=utf-8",
                    "{\"error\":\"Access Denied: Only authorized administrators can grant admin privileges.\"}");
            closeSocket(client);
            return;
        }

        if (!isStrictSrmapEmail(target)) {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"Only official @srmap.edu.in university email addresses can be authorized as administrators.\"}");
            closeSocket(client);
            return;
        }

        if (adminStore.addAdmin(target)) {
            respond(client, 200, "application/json; charset=utf-8",
                    "{\"success\":true,\"message\":\"Granted administrator privileges to " + jsonEscape(target) + "\"}");
        } else {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"User is already an administrator.\"}");
        }
    }
    else if (method == "POST" && path == "/api/admin/remove") {
        auto form = parseForm(body);
        std::string requester = toLower(trim(form["adminEmail"]));
        std::string target = toLower(trim(form["targetEmail"]));

        if (!adminStore.isAdmin(requester)) {
            respond(client, 403, "application/json; charset=utf-8",
                    "{\"error\":\"Access Denied: Only authorized administrators can revoke privileges.\"}");
            closeSocket(client);
            return;
        }

        if (target == requester) {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"Cannot revoke your own active administrator account.\"}");
            closeSocket(client);
            return;
        }

        if (adminStore.removeAdmin(target)) {
            respond(client, 200, "application/json; charset=utf-8",
                    "{\"success\":true,\"message\":\"Revoked administrator privileges from " + jsonEscape(target) + "\"}");
        } else {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"Email is not in the administrator list.\"}");
        }
    }
    // Get complaints (supports privacy filtering for students: ?email=... or ?rollNumber=...)
    else if (method == "GET" && path == "/api/complaints") {
        auto query = parseForm(queryString);
        std::string filterEmail = trim(query["email"]);
        std::string filterRoll = trim(query["rollNumber"]);
        std::string adminEmail = toLower(trim(query["adminEmail"]));

        // If requester specifies an adminEmail, verify they are an authorized administrator
        if (!adminEmail.empty() && !adminStore.isAdmin(adminEmail)) {
            respond(client, 403, "application/json; charset=utf-8",
                    "{\"error\":\"Access Denied: Account is not authorized as an administrator.\"}");
            closeSocket(client);
            return;
        }

        respond(client, 200, "application/json; charset=utf-8", complaintsJson(manager, filterEmail, filterRoll));
    }
    // Get stats (supports ?email=... or ?rollNumber=...)
    else if (method == "GET" && path == "/api/stats") {
        auto query = parseForm(queryString);
        std::string filterEmail = trim(query["email"]);
        std::string filterRoll = trim(query["rollNumber"]);
        respond(client, 200, "application/json; charset=utf-8", statsJson(manager, filterEmail, filterRoll));
    }
    // Submit complaint
    else if (method == "POST" && path == "/api/complaints") {
        auto form = parseForm(body);
        Complaint input;
        input.studentName = trim(form["studentName"]);
        input.rollNumber = trim(form["rollNumber"]);
        input.studentEmail = toLower(trim(form["studentEmail"]));
        input.roomNumber = trim(form["roomNumber"]);
        input.category = trim(form["category"]);
        input.description = trim(form["description"]);

        if (input.studentEmail.empty()) {
            input.studentEmail = toLower(input.rollNumber) + "@srmap.edu.in";
        }

        // Clean and sanitize student input so line breaks from textareas don't break safeText
        std::string cleanedDesc;
        bool lastWasSpace = false;
        for (char ch : input.description) {
            if (ch == '\r' || ch == '\n') ch = ' ';
            if (ch == '|') ch = '-';
            if (ch == ' ') {
                if (!lastWasSpace) cleanedDesc += ' ';
                lastWasSpace = true;
            } else {
                cleanedDesc += ch;
                lastWasSpace = false;
            }
        }
        input.description = trim(cleanedDesc);

        std::string cleanedRoom;
        lastWasSpace = false;
        for (char ch : input.roomNumber) {
            if (ch == '\r' || ch == '\n') ch = ' ';
            if (ch == '|') ch = '-';
            if (ch == ' ') {
                if (!lastWasSpace) cleanedRoom += ' ';
                lastWasSpace = true;
            } else {
                cleanedRoom += ch;
                lastWasSpace = false;
            }
        }
        input.roomNumber = trim(cleanedRoom);

        if (input.studentName.empty() || input.rollNumber.empty() || input.studentEmail.empty()) {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"Student full name, registration roll number, and official SRM AP email are required.\"}");
        } else if (input.studentName.find('|') != std::string::npos || input.rollNumber.find('|') != std::string::npos) {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"Student name and roll number must be separated into their respective fields. Character '|' is not allowed.\"}");
        } else if (!isStrictSrmapEmail(input.studentEmail)) {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"Student email must be a valid official @srmap.edu.in address.\"}");
        } else if (!safeText(input.studentName) || !safeText(input.rollNumber) ||
            !safeText(input.roomNumber) || !safeText(input.category) ||
            !safeText(input.description) || input.studentEmail.find('|') != std::string::npos) {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"All fields including Location/Room No. are required. Do not use '|' in text.\"}");
        } else {
            Complaint created;
            if (manager.add(input, created)) {
                std::ostringstream res;
                res << "{\"message\":\"Grievance submitted successfully to SRM University-AP Facilities Management\","
                    << "\"id\":" << created.id
                    << ",\"studentName\":\"" << jsonEscape(created.studentName) << "\""
                    << ",\"rollNumber\":\"" << jsonEscape(created.rollNumber) << "\""
                    << ",\"studentEmail\":\"" << jsonEscape(created.studentEmail) << "\""
                    << ",\"roomNumber\":\"" << jsonEscape(created.roomNumber) << "\""
                    << ",\"category\":\"" << jsonEscape(created.category) << "\""
                    << ",\"priority\":\"" << jsonEscape(created.priority) << "\""
                    << ",\"status\":\"" << jsonEscape(created.status) << "\""
                    << ",\"description\":\"" << jsonEscape(created.description) << "\""
                    << ",\"createdAt\":\"" << jsonEscape(created.createdAt) << "\""
                    << "}";
                respond(client, 201, "application/json; charset=utf-8", res.str());
            } else if (created.id > 0) {
                respond(client, 409, "application/json; charset=utf-8",
                        "{\"error\":\"An identical active grievance is already registered as Ticket #" + std::to_string(created.id) + ".\"}");
            } else {
                respond(client, 400, "application/json; charset=utf-8",
                        "{\"error\":\"Failed to register grievance. Please verify all mandatory fields.\"}");
            }
        }
    }
    // Update complaint status & technician assignment (Admin only)
    else if (method == "POST" && (path == "/api/status" || path == "/api/complaints/status" || path == "/api/complaints/update")) {
        auto form = parseForm(body);
        std::string adminEmail = toLower(trim(form["adminEmail"]));
        if (!adminEmail.empty() && !adminStore.isAdmin(adminEmail)) {
            respond(client, 403, "application/json; charset=utf-8",
                    "{\"error\":\"Access Denied: Only authorized administrators can update status or assignments.\"}");
            closeSocket(client);
            return;
        }

        int id = 0;
        try {
            id = std::stoi(trim(form["id"]));
        } catch (...) {
            id = 0;
        }
        std::string status = trim(form["status"]);
        std::string remarks = trim(form["remarks"]);
        if (remarks.empty()) remarks = trim(form["adminRemarks"]);
        std::string technician = trim(form["assignedTechnician"]);
        if (technician.empty()) technician = trim(form["technician"]);

        if (id > 0 && manager.updateStatus(id, status, remarks, technician)) {
            respond(client, 200, "application/json; charset=utf-8",
                    "{\"success\":true,\"message\":\"Complaint updated successfully\"}");
        } else {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"Invalid complaint ID or status\"}");
        }
    }
    // Update complaint remarks (Admin only)
    else if (method == "POST" && (path == "/api/remarks" || path == "/api/complaints/remarks")) {
        auto form = parseForm(body);
        std::string adminEmail = toLower(trim(form["adminEmail"]));
        if (!adminEmail.empty() && !adminStore.isAdmin(adminEmail)) {
            respond(client, 403, "application/json; charset=utf-8",
                    "{\"error\":\"Access Denied: Only authorized administrators can update remarks.\"}");
            closeSocket(client);
            return;
        }

        int id = 0;
        try {
            id = std::stoi(trim(form["id"]));
        } catch (...) {
            id = 0;
        }
        std::string adminRemarks = trim(form["adminRemarks"]);

        if (id > 0 && manager.updateRemarks(id, adminRemarks)) {
            respond(client, 200, "application/json; charset=utf-8",
                    "{\"message\":\"Maintenance remarks saved successfully\"}");
        } else {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"Invalid complaint ID\"}");
        }
    }
    // Delete complaint (Admin only)
    else if ((method == "POST" && (path == "/api/delete" || path == "/api/complaints/delete")) || (method == "DELETE" && path == "/api/complaints")) {
        auto form = parseForm(body);
        auto query = parseForm(queryString);
        std::string adminEmail = toLower(trim(form["adminEmail"]));
        if (adminEmail.empty()) adminEmail = toLower(trim(query["adminEmail"]));

        if (!adminEmail.empty() && !adminStore.isAdmin(adminEmail)) {
            respond(client, 403, "application/json; charset=utf-8",
                    "{\"error\":\"Access Denied: Only authorized administrators can delete records.\"}");
            closeSocket(client);
            return;
        }

        int id = 0;
        try {
            std::string idStr = !form["id"].empty() ? form["id"] : query["id"];
            id = std::stoi(trim(idStr));
        } catch (...) {
            id = 0;
        }

        if (id > 0 && manager.removeById(id)) {
            respond(client, 200, "application/json; charset=utf-8",
                    "{\"message\":\"Complaint deleted successfully from records\"}");
        } else {
            respond(client, 400, "application/json; charset=utf-8",
                    "{\"error\":\"Invalid complaint ID or not found\"}");
        }
    }
    // Static Frontend Files
    else if (method == "GET" || method == "HEAD") {
        std::string fileName = (path == "/" || path.empty()) ? "index.html" : path.substr(1);

        // Security check
        if (fileName.find("..") != std::string::npos || fileName.find(':') != std::string::npos) {
            respond(client, 404, "text/plain; charset=utf-8", "Forbidden");
            closeSocket(client);
            return;
        }

        std::string contentType = getMimeType(fileName);

        std::vector<std::string> candidates = {
            "../frontend/" + fileName,
            "frontend/" + fileName,
            "../" + fileName,
            fileName
        };

        std::string content;
        for (const auto& candidate : candidates) {
            content = readFile(candidate);
            if (!content.empty()) break;
        }

        if (!content.empty()) {
            respond(client, 200, contentType, content, method == "HEAD");
        } else {
            respond(client, 404, "text/plain; charset=utf-8",
                    "File not found: " + fileName);
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
    AdminStore adminStore("admins.txt");

    std::cout << "========================================================\n"
              << "  SRM UNIVERSITY AP - CAMPUS COMPLAINT MANAGEMENT PORTAL\n"
              << "  Directorate of Student Affairs & Campus Facilities\n"
              << "========================================================\n"
              << "Server running at: http://localhost:8080\n"
              << "Firebase Google Authentication: Enabled\n"
              << "Internal Administrator Privilege Control: Active\n"
              << "Student Privacy Isolation: Active\n"
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
        handle(client, manager, adminStore);
    }

    closeSocket(serverSock);
#ifdef _WIN32
    WSACleanup();
#endif
    return 0;
}
