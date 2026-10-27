#include "ComplaintManager.h"
#include <iostream>
#include <limits>
#include <string>

static std::string readLine(const std::string& prompt) {
    std::string value;
    std::cout << prompt;
    std::getline(std::cin, value);
    return value;
}

int main() {
    ComplaintManager manager("complaints.txt");
    int choice = 0;
    do {
        std::cout << "\n=====================================\n"
                  << " CAMPUS COMPLAINT MANAGEMENT SYSTEM\n"
                  << "=====================================\n"
                  << "1. Submit complaint\n2. View all complaints\n3. Search complaint by ID\n"
                  << "4. Update complaint status (admin demo)\n5. View statistics\n0. Exit\n"
                  << "Choice: ";
        if (!(std::cin >> choice)) break;
        std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
        if (choice == 1) {
            Complaint c;
            c.studentName = readLine("Student name: ");
            c.rollNumber = readLine("Roll number: ");
            c.category = readLine("Category (Wi-Fi/Classroom/Hostel/Library/Cleanliness/Electrical/Other): ");
            c.description = readLine("Describe the problem: ");
            if (c.studentName.empty() || c.rollNumber.empty() || c.category.empty() || c.description.empty() ||
                c.studentName.find('|') != std::string::npos || c.rollNumber.find('|') != std::string::npos ||
                c.category.find('|') != std::string::npos || c.description.find('|') != std::string::npos) {
                std::cout << "Please enter all fields and do not use the | character.\n";
            } else {
                Complaint created;
                if (manager.add(c, created)) std::cout << "Complaint submitted. Your ID is " << created.id << ".\n";
                else std::cout << "Could not save complaint. Check folder permissions.\n";
            }
        } else if (choice == 2 || choice == 3) {
            int searchId = -1;
            if (choice == 3) { std::cout << "Complaint ID: "; std::cin >> searchId; std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n'); }
            bool found = false;
            for (const auto& c : manager.getAll()) {
                if (choice == 3 && c.id != searchId) continue;
                found = true;
                std::cout << "\nID: " << c.id << " | " << c.studentName << " | " << c.rollNumber
                          << " | " << c.category << " | " << c.status << "\nDescription: " << c.description << "\n";
            }
            if (!found) std::cout << "No matching complaints found.\n";
        } else if (choice == 4) {
            int id; std::cout << "Complaint ID: "; std::cin >> id; std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
            std::cout << "Status options: Pending, In Progress, Resolved\n";
            const std::string status = readLine("New status: ");
            std::cout << (manager.updateStatus(id, status) ? "Status updated.\n" : "Could not update. Check ID and status.\n");
        } else if (choice == 5) {
            int pending = 0, progress = 0, resolved = 0;
            for (const auto& c : manager.getAll()) {
                if (c.status == "Pending") ++pending;
                else if (c.status == "In Progress") ++progress;
                else if (c.status == "Resolved") ++resolved;
            }
            std::cout << "Total: " << manager.getAll().size() << " | Pending: " << pending
                      << " | In Progress: " << progress << " | Resolved: " << resolved << "\n";
        } else if (choice != 0) std::cout << "Invalid choice. Try again.\n";
    } while (choice != 0);
    std::cout << "Goodbye!\n";
    return 0;
}
