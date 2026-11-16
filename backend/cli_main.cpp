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
        std::cout << "\n=======================================================\n"
                  << "  SRM UNIVERSITY AP - CAMPUS COMPLAINT MANAGEMENT SYSTEM\n"
                  << "  Directorate of Student Affairs & Campus Facilities\n"
                  << "=======================================================\n"
                  << "1. Submit complaint (Student)\n"
                  << "2. View all complaints (Admin/Student)\n"
                  << "3. Search complaint by ID\n"
                  << "4. Update complaint status & remarks (Admin)\n"
                  << "5. Delete complaint (Admin)\n"
                  << "6. View campus statistics\n"
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
            std::cout << "Exiting SRM AP Portal CLI. Goodbye!\n";
            break;
        } else if (choice == 1) {
            Complaint input;
            input.studentName = readLine("Student full name: ");
            input.rollNumber = readLine("Roll number (e.g. AP23110010838): ");
            input.studentEmail = readLine("SRM AP Email (e.g. roll@srmap.edu.in): ");
            if (input.studentEmail.empty()) {
                input.studentEmail = input.rollNumber + "@srmap.edu.in";
            }
            input.roomNumber = readLine("Hostel/Block & Room No. (e.g. Ganga-512, Neerukonda-304): ");
            input.category = readLine("Category (Wi-Fi and Internet / Electrical / Plumbing Problem / Hostel & Mess / Classroom & Lab / Cleanliness & Hygiene / Library / Other): ");
            input.description = readLine("Describe the problem: ");

            if (input.studentName.empty() || input.rollNumber.empty() ||
                input.roomNumber.empty() || input.category.empty() ||
                input.description.empty() ||
                containsInvalidChars(input.studentName) ||
                containsInvalidChars(input.rollNumber) ||
                containsInvalidChars(input.studentEmail) ||
                containsInvalidChars(input.roomNumber) ||
                containsInvalidChars(input.category) ||
                containsInvalidChars(input.description)) {
                std::cout << "Error: Please enter all fields and do not use the '|' character.\n";
                continue;
            }

            Complaint created;
            if (manager.add(input, created)) {
                std::cout << "\n>>> Grievance Ticket #" << created.id << " registered successfully!\n"
                          << ">>> Auto-Calculated Priority: " << created.priority << "\n"
                          << ">>> Location: " << created.roomNumber << "\n"
                          << ">>> Student: " << created.studentName << " (" << created.studentEmail << ")\n";
            } else {
                std::cout << "Error: Could not save complaint. Check folder permissions.\n";
            }
        } else if (choice == 2) {
            const auto& list = manager.getAll();
            if (list.empty()) {
                std::cout << "No complaints found in system records.\n";
            } else {
                for (const auto& c : list) {
                    std::cout << "\n-------------------------------------------------------\n"
                              << "Ticket #" << c.id << " | [" << c.priority << " Priority] | Status: " << c.status << "\n"
                              << "Student: " << c.studentName << " (" << c.rollNumber << " - " << c.studentEmail << ")\n"
                              << "Location: " << c.roomNumber << " | Category: " << c.category << "\n"
                              << "Logged: " << c.createdAt << " | Last Updated: " << c.updatedAt << "\n"
                              << "Description: " << c.description << "\n";
                    if (!c.adminRemarks.empty()) {
                        std::cout << "Admin Remarks: " << c.adminRemarks << "\n";
                    }
                }
            }
        } else if (choice == 3) {
            std::cout << "Enter Ticket ID: ";
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
                    std::cout << "\n-------------------------------------------------------\n"
                              << "Ticket #" << c.id << " | [" << c.priority << " Priority] | Status: " << c.status << "\n"
                              << "Student: " << c.studentName << " (" << c.rollNumber << " - " << c.studentEmail << ")\n"
                              << "Location: " << c.roomNumber << " | Category: " << c.category << "\n"
                              << "Logged: " << c.createdAt << " | Last Updated: " << c.updatedAt << "\n"
                              << "Description: " << c.description << "\n";
                    if (!c.adminRemarks.empty()) {
                        std::cout << "Admin Remarks: " << c.adminRemarks << "\n";
                    }
                    found = true;
                    break;
                }
            }
            if (!found) {
                std::cout << "Ticket #" << id << " not found.\n";
            }
        } else if (choice == 4) {
            std::cout << "Enter Complaint ID to update: ";
            int id = 0;
            if (!(std::cin >> id)) {
                std::cin.clear();
                std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
                std::cout << "Invalid ID.\n";
                continue;
            }
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');

            std::cout << "Status choices: 1. Pending  2. In Progress  3. Resolved\n";
            std::string statusInput = readLine("Enter status (or 1/2/3): ");
            std::string status = statusInput;
            if (statusInput == "1") status = "Pending";
            else if (statusInput == "2") status = "In Progress";
            else if (statusInput == "3") status = "Resolved";

            std::string remarks = readLine("Enter Maintenance/Warden action notes (optional): ");

            if (manager.updateStatus(id, status, remarks)) {
                std::cout << "Ticket #" << id << " successfully updated to '" << status << "'!\n";
            } else {
                std::cout << "Update failed. Please check ID and status validity.\n";
            }
        } else if (choice == 5) {
            std::cout << "Enter Complaint ID to delete: ";
            int id = 0;
            if (!(std::cin >> id)) {
                std::cin.clear();
                std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
                std::cout << "Invalid ID.\n";
                continue;
            }
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');

            if (manager.removeById(id)) {
                std::cout << "Ticket #" << id << " permanently removed from system records.\n";
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
                if (c.priority == "High" && c.status != "Resolved") ++highPrio;
            }
            std::cout << "\n=== SRM UNIVERSITY AP - CAMPUS TICKET METRICS ===\n"
                      << "Total Tickets Logged : " << total << "\n"
                      << "Active Urgent / High: " << highPrio << "\n"
                      << "Pending Assignment  : " << pending << "\n"
                      << "Maintenance Underway: " << inProgress << "\n"
                      << "Resolved & Closed   : " << resolved << "\n";
        } else {
            std::cout << "Invalid choice. Please select 0 to 6.\n";
        }
    }

    return 0;
}
