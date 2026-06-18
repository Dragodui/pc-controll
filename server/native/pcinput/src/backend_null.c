#include "pcinput_internal.h"

#include <string.h>

static int null_init(void) {
    return PCINPUT_OK;
}

static void null_shutdown(void) {
}

static int null_get_capabilities(pc_caps_t* out) {
    if (out == 0) {
        return pc_invalid_argument("capabilities output pointer is null");
    }
    memset(out, 0, sizeof(*out));
    out->degraded = 1;
    return PCINPUT_OK;
}

static int null_mouse_move_relative(int dx, int dy) {
    (void)dx;
    (void)dy;
    return pc_unsupported("relative mouse movement");
}

static int null_mouse_move_absolute(int x, int y) {
    (void)x;
    (void)y;
    return pc_unsupported("absolute mouse movement");
}

static int null_mouse_click(pc_mouse_button_t button) {
    (void)button;
    return pc_unsupported("mouse click");
}

static int null_mouse_scroll(int dx, int dy) {
    (void)dx;
    (void)dy;
    return pc_unsupported("mouse scroll");
}

static int null_keyboard_type_utf8(const char* text) {
    (void)text;
    return pc_unsupported("keyboard text input");
}

static int null_keyboard_tap(pc_key_t key) {
    (void)key;
    return pc_unsupported("keyboard tap");
}

static int null_keyboard_down(pc_key_t key) {
    (void)key;
    return pc_unsupported("keyboard key down");
}

static int null_keyboard_up(pc_key_t key) {
    (void)key;
    return pc_unsupported("keyboard key up");
}

static const pc_backend_t g_null_backend = {
    "null",
    null_init,
    null_shutdown,
    null_get_capabilities,
    null_mouse_move_relative,
    null_mouse_move_absolute,
    null_mouse_click,
    null_mouse_scroll,
    null_keyboard_type_utf8,
    null_keyboard_tap,
    null_keyboard_down,
    null_keyboard_up,
};

const pc_backend_t* pc_null_backend(void) {
    return &g_null_backend;
}
