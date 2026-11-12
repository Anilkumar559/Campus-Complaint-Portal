cmake_minimum_required(VERSION 3.16)
project(CampusComplaintSystem CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(complaint_cli
    backend/cli_main.cpp
    backend/ComplaintManager.cpp
)

add_executable(complaint_server
    backend/server.cpp
    backend/ComplaintManager.cpp
)

if(WIN32)
    target_link_libraries(complaint_server PRIVATE ws2_32)
endif()
