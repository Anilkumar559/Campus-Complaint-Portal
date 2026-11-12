#ifndef COMPLAINT_MANAGER_H
#define COMPLAINT_MANAGER_H

#include "Complaint.h"
#include <string>
#include <vector>

class ComplaintManager {
public:
    explicit ComplaintManager(const std::string& storagePath = "complaints.txt");

    bool load();
    bool save() const;

    const std::vector<Complaint>& getAll() const;
    int nextId() const;

    bool add(const Complaint& input, Complaint& created);
    bool updateStatus(int id, const std::string& newStatus);
    bool removeById(int id);

    static std::string determinePriority(const std::string& category, const std::string& description);

private:
    std::string storagePath_;
    std::vector<Complaint> complaints_;

    static bool isValidStatus(const std::string& status);
    static bool isValidPriority(const std::string& priority);
    static std::string currentTimestamp();
};

#endif // COMPLAINT_MANAGER_H
