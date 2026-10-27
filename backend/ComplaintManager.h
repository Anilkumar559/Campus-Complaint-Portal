#ifndef COMPLAINT_MANAGER_H
#define COMPLAINT_MANAGER_H
#include "Complaint.h"
#include <string>
#include <vector>

class ComplaintManager {
public:
    explicit ComplaintManager(const std::string& fileName = "complaints.txt");
    std::vector<Complaint> getAll() const;
    bool add(const Complaint& complaint, Complaint& created);
    bool updateStatus(int id, const std::string& status);
    int nextId() const;
private:
    std::string fileName_;
    std::vector<Complaint> complaints_;
    void load();
    bool save() const;
};
#endif
