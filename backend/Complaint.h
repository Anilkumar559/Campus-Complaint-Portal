#ifndef COMPLAINT_H
#define COMPLAINT_H

#include <string>

struct Complaint {
    int id = 0;
    std::string studentName;
    std::string rollNumber;
    std::string studentEmail; // e.g. anil_kumar@srmap.edu.in
    std::string roomNumber;   // e.g. Ganga Hostel 512, Neerukonda Block 304
    std::string category;
    std::string priority = "Medium";
    std::string description;
    std::string status = "Pending";
    std::string createdAt;
    std::string updatedAt;
    std::string adminRemarks;       // Notes by SRM AP Maintenance / Warden
    std::string assignedTechnician; // Technician or team dispatched (e.g. Electrician Ramesh)
};

#endif // COMPLAINT_H
