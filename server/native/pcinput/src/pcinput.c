#include "pcinput_internal.h"

static const pc_backend_t* g_backend = 0;
static int g_initialized = 0;

static int ensure_initialized(void) {
    if (!g_initialized || g_backend == 0) {
        pc_set_error("pcinput is not initialized");
        return PCINPUT_ERR_NOT_INITIALIZED;
    }
    return PCINPUT_OK;
}

int pc_init(void) {
    int result;

    pc_clear_error();
    if (g_initialized) {
        return PCINPUT_OK;
    }

    g_backend = pc_detect_backend();
    if (g_backend == 0) {
        g_backend = pc_null_backend();
    }

    result = g_backend->init();
    if (result != PCINPUT_OK) {
        g_backend = pc_null_backend();
        g_initialized = 1;
        return result;
    }

    g_initialized = 1;
    return PCINPUT_OK;
}

void pc_shutdown(void) {
    if (g_initialized && g_backend != 0 && g_backend->shutdown != 0) {
        g_backend->shutdown();
    }
    g_backend = 0;
    g_initialized = 0;
    pc_clear_error();
}

const char* pc_backend_name(void) {
    if (!g_initialized || g_backend == 0) {
        return "uninitialized";
    }
    return g_backend->name;
}

int pc_get_capabilities(pc_caps_t* out) {
    int result = ensure_initialized();
    if (result != PCINPUT_OK) {
        return result;
    }
    if (out == 0) {
        return pc_invalid_argument("capabilities output pointer is null");
    }
    return g_backend->get_capabilities(out);
}

int pc_mouse_move_relative(int dx, int dy) {
    int result = ensure_initialized();
    if (result != PCINPUT_OK) {
        return result;
    }
    return g_backend->mouse_move_relative(dx, dy);
}

int pc_mouse_move_absolute(int x, int y) {
    int result = ensure_initialized();
    if (result != PCINPUT_OK) {
        return result;
    }
    return g_backend->mouse_move_absolute(x, y);
}

int pc_mouse_click(pc_mouse_button_t button) {
    int result = ensure_initialized();
    if (result != PCINPUT_OK) {
        return result;
    }
    return g_backend->mouse_click(button);
}

int pc_mouse_scroll(int dx, int dy) {
    int result = ensure_initialized();
    if (result != PCINPUT_OK) {
        return result;
    }
    return g_backend->mouse_scroll(dx, dy);
}

int pc_keyboard_type_utf8(const char* text) {
    int result = ensure_initialized();
    if (result != PCINPUT_OK) {
        return result;
    }
    if (text == 0) {
        return pc_invalid_argument("keyboard text pointer is null");
    }
    return g_backend->keyboard_type_utf8(text);
}

int pc_keyboard_tap(pc_key_t key) {
    int result = ensure_initialized();
    if (result != PCINPUT_OK) {
        return result;
    }
    return g_backend->keyboard_tap(key);
}

int pc_keyboard_down(pc_key_t key) {
    int result = ensure_initialized();
    if (result != PCINPUT_OK) {
        return result;
    }
    return g_backend->keyboard_down(key);
}

int pc_keyboard_up(pc_key_t key) {
    int result = ensure_initialized();
    if (result != PCINPUT_OK) {
        return result;
    }
    return g_backend->keyboard_up(key);
}
