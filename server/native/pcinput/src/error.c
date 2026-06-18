#include "pcinput_internal.h"

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

static char g_last_error[512];

void pc_clear_error(void) {
    g_last_error[0] = '\0';
}

void pc_set_error(const char* message) {
    if (message == 0) {
        pc_clear_error();
        return;
    }
    snprintf(g_last_error, sizeof(g_last_error), "%s", message);
}

void pc_set_errorf(const char* format, ...) {
    va_list args;
    va_start(args, format);
    vsnprintf(g_last_error, sizeof(g_last_error), format, args);
    va_end(args);
}

const char* pc_last_error(void) {
    if (g_last_error[0] == '\0') {
        return "";
    }
    return g_last_error;
}

int pc_unsupported(const char* operation) {
    pc_set_errorf("%s is unsupported by the selected pcinput backend", operation);
    return PCINPUT_ERR_UNSUPPORTED;
}

int pc_invalid_argument(const char* message) {
    pc_set_error(message);
    return PCINPUT_ERR_INVALID_ARGUMENT;
}

int pc_backend_error(const char* message) {
    pc_set_error(message);
    return PCINPUT_ERR_BACKEND;
}
