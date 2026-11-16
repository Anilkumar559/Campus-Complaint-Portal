#include "ComplaintManager.h"

#include <algorithm>
#include <cctype>
#include <chrono>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <sstream>

ComplaintManager::ComplaintManager(const std::string& storagePath)
    : storagePath_(storagePath) {
    load();
}

std::string ComplaintManager::currentTimestamp() {
    auto now = std::chrono::system_clock::now();
    std::time_t t = std::chrono::system_clock::to_time_t(now);
    std::tm* tm_ptr = std::localtime(&t);
    std::ostringstream oss;
    if (tm_ptr != nullptr) {
        oss << std::put_time(tm_ptr, "%Y-%m-%d %H:%M:%S");
    }
    return oss.str();
}

bool ComplaintManager::isValidStatus(const std::string& status) {
    return status == "Pending" || status == "In Progress" || status == "Resolved";
}

bool ComplaintManager::isValidPriority(const std::string& priority) {
    return priority == "High" || priority == "Medium" || priority == "Low";
}

bool ComplaintManager::isValidSrmEmail(const std::string& email) {
    if (email.size() < 13) return false;
    std::string lower = email;
    std::transform(lower.begin(), lower.end(), lower.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    const std::string suffix = "@srmap.edu.in";
    if (lower.size() >= suffix.size() &&
        lower.compare(lower.size() - suffix.size(), suffix.size(), suffix) == 0) {
        return true;
    }
    return false;
}

std::string ComplaintManager::determinePriority(const std::string& category, const std::string& description) {
    std::string text = category + " " + description;
    std::transform(text.begin(), text.end(), text.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });

    const std::vector<std::string> highKeywords = {
        "fire", "spark", "short circuit", "shock", "hazard", "emergency", "urgent",
        "flood", "burst", "no water", "no electricity", "power outage", "blackout",
        "broken lock", "security", "smoke", "gas", "danger", "medical", "leakage", "overflow",
        "geyser", "snake", "theft", "burning", "elevator", "lift stuck", "ceiling fall"
    };
    for (const auto& kw : highKeywords) {
        if (text.find(kw) != std::string::npos) {
            return "High";
        }
    }

    std::string catLower = category;
    std::transform(catLower.begin(), catLower.end(), catLower.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });

    if (catLower.find("electrical") != std::string::npos ||
        catLower.find("plumbing") != std::string::npos ||
        catLower.find("security") != std::string::npos) {
        return "High";
    }

    if (catLower.find("wi-fi") != std::string::npos ||
        catLower.find("internet") != std::string::npos ||
        catLower.find("hostel") != std::string::npos ||
        catLower.find("mess") != std::string::npos ||
        catLower.find("air conditioning") != std::string::npos ||
        catLower.find("classroom") != std::string::npos ||
        catLower.find("lab") != std::string::npos) {
        return "Medium";
    }

    if (catLower.find("cleanliness") != std::string::npos ||
        catLower.find("library") != std::string::npos ||
        catLower.find("other") != std::string::npos) {
        return "Low";
    }

    return "Medium";
}

bool ComplaintManager::load() {
    complaints_.clear();
    std::ifstream in(storagePath_);
    if (!in.is_open()) {
        return true;
    }

    std::string line;
    bool upgradedLegacyFormat = false;

    while (std::getline(in, line)) {
        if (!line.empty() && line.back() == '\r') {
            line.pop_back();
        }
        if (line.empty()) continue;

        std::vector<std::string> parts;
        std::stringstream ss(line);
        std::string item;
        while (std::getline(ss, item, '|')) {
            parts.push_back(item);
        }

        // V4/V3 Format (10+ fields):
        // 0: id, 1: name, 2: roll, 3: room, 4: category, 5: priority, 6: status,
        // 7: description, 8: createdAt, 9: updatedAt, [10: email], [11: adminRemarks]
        if (parts.size() >= 10) {
            try {
                Complaint c;
                c.id = std::stoi(parts[0]);
                c.studentName = parts[1];
                c.rollNumber = parts[2];
                c.roomNumber = parts[3].empty() ? "N/A" : parts[3];
                c.category = parts[4];
                c.priority = isValidPriority(parts[5]) ? parts[5] : determinePriority(c.category, parts[7]);
                c.status = isValidStatus(parts[6]) ? parts[6] : "Pending";
                c.description = parts[7];
                c.createdAt = parts[8].empty() ? currentTimestamp() : parts[8];
                c.updatedAt = parts[9].empty() ? c.createdAt : parts[9];

                if (parts.size() >= 11 && !parts[10].empty()) {
                    c.studentEmail = parts[10];
                } else {
                    c.studentEmail = c.rollNumber + "@srmap.edu.in";
                }

                if (parts.size() >= 12) {
                    c.adminRemarks = parts[11];
                } else {
                    c.adminRemarks = "";
                }

                if (parts.size() >= 13) {
                    c.assignedTechnician = parts[12];
                } else {
                    c.assignedTechnician = "";
                }

                complaints_.push_back(c);
            } catch (...) {}
        }
        // V1/V2 Format (6 or 8 fields): id|name|roll|category|status|description[|createdAt|updatedAt]
        else if (parts.size() >= 6) {
            try {
                Complaint c;
                c.id = std::stoi(parts[0]);
                c.studentName = parts[1];
                c.rollNumber = parts[2];
                c.studentEmail = c.rollNumber + "@srmap.edu.in";
                c.roomNumber = "N/A";
                c.category = parts[3];
                c.status = isValidStatus(parts[4]) ? parts[4] : "Pending";
                c.description = parts[5];
                c.priority = determinePriority(c.category, c.description);
                c.createdAt = (parts.size() >= 7 && !parts[6].empty()) ? parts[6] : currentTimestamp();
                c.updatedAt = (parts.size() >= 8 && !parts[7].empty()) ? parts[7] : c.createdAt;
                c.adminRemarks = "";
                complaints_.push_back(c);
                upgradedLegacyFormat = true;
            } catch (...) {}
        }
    }
    in.close();

    // Auto-recovery fallback: If complaints_ is still empty, inspect alternate candidate storage paths
    if (complaints_.empty()) {
        std::vector<std::string> fallbackCandidates = {
            "complaints.txt",
            "../complaints.txt",
            "backend/complaints.txt",
            "backend/complaints_sample_backup.txt",
            "../backend/complaints_sample_backup.txt"
        };
        for (const auto& altPath : fallbackCandidates) {
            if (altPath == storagePath_) continue;
            std::ifstream altIn(altPath);
            if (!altIn.is_open()) continue;

            std::string altLine;
            while (std::getline(altIn, altLine)) {
                if (!altLine.empty() && altLine.back() == '\r') altLine.pop_back();
                if (altLine.empty()) continue;
                std::vector<std::string> parts;
                std::stringstream ss(altLine);
                std::string item;
                while (std::getline(ss, item, '|')) parts.push_back(item);
                if (parts.size() >= 10) {
                    try {
                        Complaint c;
                        c.id = std::stoi(parts[0]);
                        c.studentName = parts[1];
                        c.rollNumber = parts[2];
                        c.roomNumber = parts[3].empty() ? "N/A" : parts[3];
                        c.category = parts[4];
                        c.priority = isValidPriority(parts[5]) ? parts[5] : determinePriority(c.category, parts[7]);
                        c.status = isValidStatus(parts[6]) ? parts[6] : "Pending";
                        c.description = parts[7];
                        c.createdAt = parts[8].empty() ? currentTimestamp() : parts[8];
                        c.updatedAt = parts[9].empty() ? c.createdAt : parts[9];
                        c.studentEmail = (parts.size() >= 11 && !parts[10].empty()) ? parts[10] : (c.rollNumber + "@srmap.edu.in");
                        c.adminRemarks = (parts.size() >= 12) ? parts[11] : "";
                        c.assignedTechnician = (parts.size() >= 13) ? parts[12] : "";
                        complaints_.push_back(c);
                    } catch (...) {}
                }
            }
            altIn.close();
            if (!complaints_.empty()) {
                save(); // Persist recovered records
                break;
            }
        }
    }

    // Auto-migrate legacy records to the full format on disk
    if (upgradedLegacyFormat && !complaints_.empty()) {
        save();
    }
    return true;
}

bool ComplaintManager::save() const {
    std::ofstream out(storagePath_, std::ios::trunc);
    if (!out.is_open()) {
        return false;
    }

    for (const auto& c : complaints_) {
        out << c.id << '|'
            << c.studentName << '|'
            << c.rollNumber << '|'
            << c.roomNumber << '|'
            << c.category << '|'
            << c.priority << '|'
            << c.status << '|'
            << c.description << '|'
            << c.createdAt << '|'
            << c.updatedAt << '|'
            << c.studentEmail << '|'
            << c.adminRemarks << '|'
            << c.assignedTechnician << '\n';
    }
    out.close();

    // Mirror to root or backend/ to prevent desynchronization
    std::string mirrorPath;
    if (storagePath_ == "complaints.txt") {
        mirrorPath = "backend/complaints.txt";
    } else if (storagePath_ == "backend/complaints.txt") {
        mirrorPath = "complaints.txt";
    }
    if (!mirrorPath.empty()) {
        std::ofstream mOut(mirrorPath, std::ios::trunc);
        if (mOut.is_open()) {
            for (const auto& c : complaints_) {
                mOut << c.id << '|'
                     << c.studentName << '|'
                     << c.rollNumber << '|'
                     << c.roomNumber << '|'
                     << c.category << '|'
                     << c.priority << '|'
                     << c.status << '|'
                     << c.description << '|'
                     << c.createdAt << '|'
                     << c.updatedAt << '|'
                     << c.studentEmail << '|'
                     << c.adminRemarks << '|'
                     << c.assignedTechnician << '\n';
            }
            mOut.close();
        }
    }

    return true;
}

const std::vector<Complaint>& ComplaintManager::getAll() const {
    return complaints_;
}

int ComplaintManager::nextId() const {
    int maxId = 100;
    for (const auto& c : complaints_) {
        if (c.id > maxId) {
            maxId = c.id;
        }
    }
    return maxId + 1;
}

bool ComplaintManager::add(const Complaint& input, Complaint& created) {
    if (input.studentName.empty() || input.rollNumber.empty() ||
        input.roomNumber.empty() || input.category.empty() ||
        input.description.empty()) {
        return false;
    }

    // Duplicate Prevention: Check if the exact active complaint was already filed
    for (const auto& existing : complaints_) {
        if (existing.studentEmail == input.studentEmail &&
            existing.category == input.category &&
            existing.roomNumber == input.roomNumber &&
            existing.description == input.description &&
            existing.status != "Resolved") {
            created = existing;
            return false;
        }
    }

    created = input;
    created.id = nextId();
    created.status = "Pending";
    created.priority = determinePriority(created.category, created.description);
    if (created.studentEmail.empty()) {
        created.studentEmail = created.rollNumber + "@srmap.edu.in";
    }
    std::string now = currentTimestamp();
    created.createdAt = now;
    created.updatedAt = now;

    complaints_.push_back(created);
    if (!save()) {
        complaints_.pop_back();
        return false;
    }
    return true;
}

bool ComplaintManager::updateStatus(int id, const std::string& newStatus, const std::string& remarks, const std::string& technician) {
    if (!newStatus.empty() && !isValidStatus(newStatus)) {
        return false;
    }
    for (auto& c : complaints_) {
        if (c.id == id) {
            std::string prevStatus = c.status;
            std::string prevUpdated = c.updatedAt;
            std::string prevRemarks = c.adminRemarks;
            std::string prevTech = c.assignedTechnician;

            if (!newStatus.empty()) c.status = newStatus;
            c.updatedAt = currentTimestamp();
            if (!remarks.empty()) {
                c.adminRemarks = remarks;
            }
            if (!technician.empty()) {
                c.assignedTechnician = technician;
            }
            if (!save()) {
                c.status = prevStatus;
                c.updatedAt = prevUpdated;
                c.adminRemarks = prevRemarks;
                c.assignedTechnician = prevTech;
                return false;
            }
            return true;
        }
    }
    return false;
}

bool ComplaintManager::updateComplaintDetails(int id, const std::string& status, const std::string& remarks, const std::string& technician) {
    return updateStatus(id, status, remarks, technician);
}

bool ComplaintManager::updateRemarks(int id, const std::string& remarks) {
    for (auto& c : complaints_) {
        if (c.id == id) {
            std::string prevRemarks = c.adminRemarks;
            std::string prevUpdated = c.updatedAt;
            c.adminRemarks = remarks;
            c.updatedAt = currentTimestamp();
            if (!save()) {
                c.adminRemarks = prevRemarks;
                c.updatedAt = prevUpdated;
                return false;
            }
            return true;
        }
    }
    return false;
}

bool ComplaintManager::removeById(int id) {
    auto it = std::find_if(complaints_.begin(), complaints_.end(),
                           [id](const Complaint& c) { return c.id == id; });
    if (it == complaints_.end()) {
        return false;
    }
    Complaint backup = *it;
    auto pos = std::distance(complaints_.begin(), it);
    complaints_.erase(it);
    if (!save()) {
        complaints_.insert(complaints_.begin() + pos, backup);
        return false;
    }
    return true;
}
