#include "ComplaintManager.h"

#include <iostream>
#include <limits>
#include <string>

namespace {

std::string readLine(const std::string& prompt) {
    std::cout << prompt;
    std::string value;
    std::getline(std::cin, value);
    return value;
}

bool containsInvalidChars(const std::string& s) {
    return s.find('|') != std::string::npos ||
           s.find('\n') != std::string::npos ||
           s.find('\r') != std::string::npos;
}

} // namespace

int main() {
    ComplaintManager manager("complaints.txt");

    while (true) {
        std::cout << "\n=====================================\n"
                  << "  CAMPUS COMPLAINT MANAGEMENT SYSTEM\n"
                  << "=====================================\n"
                  << "1. Submit complaint\n"
                  << "2. View all complaints\n"
                  << "3. Search complaint by ID\n"
                  << "4. Update complaint status (admin demo)\n"
                  << "5. Delete complaint (admin demo)\n"
                  << "6. View statistics\n"
                  << "0. Exit\n"
                  << "Choice: ";

        int choice = -1;
        if (!(std::cin >> choice)) {
            std::cin.clear();
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
            std::cout << "Invalid input. Please enter a number.\n";
            continue;
        }
        std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');

        if (choice == 0) {
            std::cout << "Goodbye!\n";
            break;
        } else if (choice == 1) {
            Complaint input;
            input.studentName = readLine("Student name: ");
            input.rollNumber = readLine("Roll number: ");
            input.roomNumber = readLine("Room No. / Block: ");
            input.category = readLine("Category (Wi-Fi and Internet/Classroom & Lab/Hostel & Mess/Electrical/Plumbing Problem/Cleanliness & Hygiene/Library/Other): ");
            input.description = readLine("Describe the problem: ");

            if (input.studentName.empty() || input.rollNumber.empty() ||
                input.roomNumber.empty() || input.category.empty() ||
                input.description.empty() ||
                containsInvalidChars(input.studentName) ||
                containsInvalidChars(input.rollNumber) ||
                containsInvalidChars(input.roomNumber) ||
                containsInvalidChars(input.category) ||
                containsInvalidChars(input.description)) {
                std::cout << "Please enter all fields and do not use the | character.\n";
                continue;
            }

            Complaint created;
            if (manager.add(input, created)) {
                std::cout << "Complaint submitted! ID: " << created.id
                          << " | Auto-Assigned Priority: " << created.priority << "\n";
            } else {
                std::cout << "Could not save complaint. Check folder permissions.\n";
            }
        } else if (choice == 2) {
            const auto& list = manager.getAll();
            if (list.empty()) {
                std::cout << "No matching complaints found.\n";
            } else {
                for (const auto& c : list) {
                    std::cout << "\nID: " << c.id
                              << " | " << c.studentName << " (" << c.rollNumber << ")"
                              << " | Room: " << c.roomNumber
                              << " | Category: " << c.category
                              << " | Priority: " << c.priority
                              << " | Status: " << c.status << "\n"
                              << "Description: " << c.description << "\n";
                }
            }
        } else if (choice == 3) {
            std::cout << "Complaint ID: ";
            int id = 0;
            if (!(std::cin >> id)) {
                std::cin.clear();
                std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
                std::cout << "Invalid ID.\n";
                continue;
            }
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');

            bool found = false;
            for (const auto& c : manager.getAll()) {
                if (c.id == id) {
                    std::cout << "\nID: " << c.id
                              << " | " << c.studentName << " (" << c.rollNumber << ")"
                              << " | Room: " << c.roomNumber
                              << " | Category: " << c.category
                              << " | Priority: " << c.priority
                              << " | Status: " << c.status
                              << " | Created: " << c.createdAt << "\n"
                              << "Description: " << c.description << "\n";
                    found = true;
                    break;
                }
            }
            if (!found) {
                std::cout << "No matching complaints found.\n";
            }
        } else if (choice == 4) {
            std::cout << "Complaint ID: ";
            int id = 0;
            if (!(std::cin >> id)) {
                std::cin.clear();
                std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
                std::cout << "Invalid ID.\n";
                continue;
            }
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');

            std::cout << "Status options: Pending, In Progress, Resolved\n";
            std::string status = readLine("New status: ");
            if (manager.updateStatus(id, status)) {
                std::cout << "Status updated.\n";
            } else {
                std::cout << "Could not update. Check ID and status.\n";
            }
        } else if (choice == 5) {
            std::cout << "Complaint ID to delete: ";
            int id = 0;
            if (!(std::cin >> id)) {
                std::cin.clear();
                std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
                std::cout << "Invalid ID.\n";
                continue;
            }
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');

            if (manager.removeById(id)) {
                std::cout << "Complaint deleted.\n";
            } else {
                std::cout << "Complaint ID not found.\n";
            }
        } else if (choice == 6) {
            int total = 0, pending = 0, inProgress = 0, resolved = 0, highPrio = 0;
            for (const auto& c : manager.getAll()) {
                ++total;
                if (c.status == "Pending") ++pending;
                else if (c.status == "In Progress") ++inProgress;
                else if (c.status == "Resolved") ++resolved;
                if (c.priority == "High") ++highPrio;
            }
            std::cout << "Total: " << total
                      << " | High Priority: " << highPrio
                      << " | Pending: " << pending
                      << " | In Progress: " << inProgress
                      << " | Resolved: " << resolved << "\n";
        } else {
            std::cout << "Invalid choice. Try again.\n";
        }
    }

    return 0;
}
