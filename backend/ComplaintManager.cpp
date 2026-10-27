#include "ComplaintManager.h"
#include <fstream>
#include <sstream>

ComplaintManager::ComplaintManager(const std::string& fileName) : fileName_(fileName) { load(); }

void ComplaintManager::load() {
    complaints_.clear();
    std::ifstream in(fileName_);
    std::string line;
    while (std::getline(in, line)) {
        std::stringstream ss(line);
        std::string field;
        Complaint c;
        if (!std::getline(ss, field, '|')) continue;
        try { c.id = std::stoi(field); } catch (...) { continue; }
        if (!std::getline(ss, c.studentName, '|')) continue;
        if (!std::getline(ss, c.rollNumber, '|')) continue;
        if (!std::getline(ss, c.category, '|')) continue;
        if (!std::getline(ss, c.status, '|')) continue;
        if (!std::getline(ss, c.description)) continue;
        complaints_.push_back(c);
    }
}

bool ComplaintManager::save() const {
    std::ofstream out(fileName_, std::ios::trunc);
    if (!out) return false;
    for (const auto& c : complaints_) {
        // Pipe characters and line breaks are rejected by the API to keep this simple file format safe.
        out << c.id << '|' << c.studentName << '|' << c.rollNumber << '|'
            << c.category << '|' << c.status << '|' << c.description << '\n';
    }
    return static_cast<bool>(out);
}

std::vector<Complaint> ComplaintManager::getAll() const { return complaints_; }
int ComplaintManager::nextId() const {
    int largest = 100;
    for (const auto& c : complaints_) if (c.id > largest) largest = c.id;
    return largest + 1;
}

bool ComplaintManager::add(const Complaint& complaint, Complaint& created) {
    created = complaint;
    created.id = nextId();
    created.status = "Pending";
    complaints_.push_back(created);
    if (!save()) { complaints_.pop_back(); return false; }
    return true;
}

bool ComplaintManager::updateStatus(int id, const std::string& status) {
    if (status != "Pending" && status != "In Progress" && status != "Resolved") return false;
    for (auto& c : complaints_) {
        if (c.id == id) {
            const std::string old = c.status;
            c.status = status;
            if (!save()) { c.status = old; return false; }
            return true;
        }
    }
    return false;
}
