#ifndef COMPLAINT_H
#define COMPLAINT_H

#include <string>

struct Complaint {
    int id = 0;
    std::string studentName;
    std::string rollNumber;
    std::string roomNumber;
    std::string category;
    std::string priority = "Medium";
    std::string description;
    std::string status = "Pending";
    std::string createdAt;
    std::string updatedAt;
};

#endif // COMPLAINT_H
