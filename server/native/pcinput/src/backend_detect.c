#include "pcinput_internal.h"

#include <stdlib.h>
#include <string.h>

static int equals_ignore_case_ascii(const char* a, const char* b) {
    while (*a != '\0' && *b != '\0') {
        char ca = *a;
        char cb = *b;
        if (ca >= 'A' && ca <= 'Z') {
            ca = (char)(ca + ('a' - 'A'));
        }
        if (cb >= 'A' && cb <= 'Z') {
            cb = (char)(cb + ('a' - 'A'));
        }
        if (ca != cb) {
            return 0;
        }
        a++;
        b++;
    }
    return *a == '\0' && *b == '\0';
}

const pc_backend_t* pc_detect_backend(void) {
    const char* forced = getenv("PCINPUT_BACKEND");
    if (forced != 0 && forced[0] != '\0' && !equals_ignore_case_ascii(forced, "auto")) {
        if (equals_ignore_case_ascii(forced, "null")) {
            return pc_null_backend();
        }
#ifdef _WIN32
        if (equals_ignore_case_ascii(forced, "windows")) {
            return pc_windows_backend();
        }
#endif
#ifdef __linux__
        if (equals_ignore_case_ascii(forced, "linux-uinput") ||
            equals_ignore_case_ascii(forced, "uinput") ||
            equals_ignore_case_ascii(forced, "wayland")) {
            return pc_linux_uinput_backend();
        }
#endif
        pc_set_errorf("unknown or unavailable PCINPUT_BACKEND: %s", forced);
        return pc_null_backend();
    }

#ifdef _WIN32
    return pc_windows_backend();
#elif defined(__linux__)
    return pc_linux_uinput_backend();
#else
    return pc_null_backend();
#endif
}
