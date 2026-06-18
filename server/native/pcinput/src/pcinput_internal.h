#ifndef PCINPUT_INTERNAL_H
#define PCINPUT_INTERNAL_H

#include "../include/pcinput.h"

typedef struct pc_backend {
    const char* name;
    int (*init)(void);
    void (*shutdown)(void);
    int (*get_capabilities)(pc_caps_t* out);
    int (*mouse_move_relative)(int dx, int dy);
    int (*mouse_move_absolute)(int x, int y);
    int (*mouse_click)(pc_mouse_button_t button);
    int (*mouse_scroll)(int dx, int dy);
    int (*keyboard_type_utf8)(const char* text);
    int (*keyboard_tap)(pc_key_t key);
    int (*keyboard_down)(pc_key_t key);
    int (*keyboard_up)(pc_key_t key);
} pc_backend_t;

const pc_backend_t* pc_detect_backend(void);
const pc_backend_t* pc_null_backend(void);

#ifdef _WIN32
const pc_backend_t* pc_windows_backend(void);
#endif

#ifdef __linux__
const pc_backend_t* pc_linux_uinput_backend(void);
#endif

void pc_set_error(const char* message);
void pc_set_errorf(const char* format, ...);
void pc_clear_error(void);

int pc_unsupported(const char* operation);
int pc_invalid_argument(const char* message);
int pc_backend_error(const char* message);

#endif
