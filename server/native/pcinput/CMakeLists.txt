cmake_minimum_required(VERSION 3.16)
project(pcinput C)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)

add_library(pcinput STATIC
    src/backend_detect.c
    src/backend_null.c
    src/error.c
    src/pcinput.c
)

if(WIN32)
    target_sources(pcinput PRIVATE src/platform_windows.c)
    target_link_libraries(pcinput PRIVATE user32)
endif()

if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
    target_sources(pcinput PRIVATE src/platform_linux_uinput.c)
endif()

target_include_directories(pcinput
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
)

if(MSVC)
    target_compile_options(pcinput PRIVATE /W4)
else()
    target_compile_options(pcinput PRIVATE -Wall -Wextra -Wpedantic)
endif()
