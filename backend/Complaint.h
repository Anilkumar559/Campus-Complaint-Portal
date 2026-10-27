#ifndef COMPLAINT_H
#define COMPLAINT_H
#include <string>

struct Complaint {
    int id = 0;
    std::string studentName;
    std::string rollNumber;
    std::string category;
    std::string description;
    std::string status = "Pending";
};

#endif
