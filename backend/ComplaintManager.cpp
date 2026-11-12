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

std::string ComplaintManager::determinePriority(const std::string& category, const std::string& description) {
    std::string text = category + " " + description;
    std::transform(text.begin(), text.end(), text.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });

    const std::vector<std::string> highKeywords = {
        "fire", "spark", "short circuit", "shock", "hazard", "emergency", "urgent",
        "flood", "burst", "no water", "no electricity", "power outage", "blackout",
        "broken lock", "security", "smoke", "gas", "danger", "medical", "leakage", "overflow"
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
        catLower.find("plumbing") != std::string::npos) {
        return "High";
    }

    if (catLower.find("wi-fi") != std::string::npos ||
        catLower.find("internet") != std::string::npos ||
        catLower.find("hostel") != std::string::npos ||
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

        // V3 Format (10 fields): id|name|roll|room|category|priority|status|description|createdAt|updatedAt
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
                c.roomNumber = "N/A";
                c.category = parts[3];
                c.status = isValidStatus(parts[4]) ? parts[4] : "Pending";
                c.description = parts[5];
                c.priority = determinePriority(c.category, c.description);
                c.createdAt = (parts.size() >= 7 && !parts[6].empty()) ? parts[6] : currentTimestamp();
                c.updatedAt = (parts.size() >= 8 && !parts[7].empty()) ? parts[7] : c.createdAt;
                complaints_.push_back(c);
                upgradedLegacyFormat = true;
            } catch (...) {}
        }
    }
    in.close();

    // Auto-migrate legacy 6/8-field records to the 10-field format on disk
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
            << c.updatedAt << '\n';
    }
    return out.good();
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

    created = input;
    created.id = nextId();
    created.status = "Pending";
    created.priority = determinePriority(created.category, created.description);
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

bool ComplaintManager::updateStatus(int id, const std::string& newStatus) {
    if (!isValidStatus(newStatus)) {
        return false;
    }
    for (auto& c : complaints_) {
        if (c.id == id) {
            std::string prevStatus = c.status;
            std::string prevUpdated = c.updatedAt;
            c.status = newStatus;
            c.updatedAt = currentTimestamp();
            if (!save()) {
                c.status = prevStatus;
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
