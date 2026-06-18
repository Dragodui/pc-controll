#ifdef _WIN32

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include "pcinput_internal.h"

#include <stdlib.h>
#include <string.h>

static WORD windows_key_code(pc_key_t key) {
    switch (key) {
    case PC_KEY_ALT:
        return VK_MENU;
    case PC_KEY_BACKSPACE:
        return VK_BACK;
    case PC_KEY_COMMAND:
        return VK_LWIN;
    case PC_KEY_ENTER:
        return VK_RETURN;
    case PC_KEY_SHIFT:
        return VK_SHIFT;
    case PC_KEY_SPACE:
        return VK_SPACE;
    case PC_KEY_TAB:
        return VK_TAB;
    default:
        return 0;
    }
}

static int send_input_checked(UINT count, INPUT* input, const char* operation) {
    UINT sent = SendInput(count, input, sizeof(INPUT));
    if (sent != count) {
        pc_set_errorf("%s failed with Windows error %lu", operation, GetLastError());
        return PCINPUT_ERR_BACKEND;
    }
    return PCINPUT_OK;
}

static int windows_init(void) {
    return PCINPUT_OK;
}

static void windows_shutdown(void) {
}

static int windows_get_capabilities(pc_caps_t* out) {
    if (out == 0) {
        return pc_invalid_argument("capabilities output pointer is null");
    }

    memset(out, 0, sizeof(*out));
    out->mouse_move_relative = 1;
    out->mouse_move_absolute = 1;
    out->mouse_click = 1;
    out->mouse_scroll = 1;
    out->keyboard_text = 1;
    out->keyboard_keys = 1;
    out->screen_capture = 0;
    out->requires_user_permission = 0;
    out->degraded = 0;
    return PCINPUT_OK;
}

static int windows_mouse_move_relative(int dx, int dy) {
    INPUT input;
    memset(&input, 0, sizeof(input));
    input.type = INPUT_MOUSE;
    input.mi.dx = dx;
    input.mi.dy = dy;
    input.mi.dwFlags = MOUSEEVENTF_MOVE;
    return send_input_checked(1, &input, "relative mouse movement");
}

static int windows_mouse_move_absolute(int x, int y) {
    if (!SetCursorPos(x, y)) {
        pc_set_errorf("absolute mouse movement failed with Windows error %lu", GetLastError());
        return PCINPUT_ERR_BACKEND;
    }
    return PCINPUT_OK;
}

static int windows_mouse_click(pc_mouse_button_t button) {
    INPUT inputs[2];
    DWORD down_flag;
    DWORD up_flag;

    switch (button) {
    case PC_MOUSE_LEFT:
        down_flag = MOUSEEVENTF_LEFTDOWN;
        up_flag = MOUSEEVENTF_LEFTUP;
        break;
    case PC_MOUSE_RIGHT:
        down_flag = MOUSEEVENTF_RIGHTDOWN;
        up_flag = MOUSEEVENTF_RIGHTUP;
        break;
    case PC_MOUSE_MIDDLE:
        down_flag = MOUSEEVENTF_MIDDLEDOWN;
        up_flag = MOUSEEVENTF_MIDDLEUP;
        break;
    default:
        return pc_invalid_argument("unsupported mouse button");
    }

    memset(inputs, 0, sizeof(inputs));
    inputs[0].type = INPUT_MOUSE;
    inputs[0].mi.dwFlags = down_flag;
    inputs[1].type = INPUT_MOUSE;
    inputs[1].mi.dwFlags = up_flag;
    return send_input_checked(2, inputs, "mouse click");
}

static int windows_mouse_scroll(int dx, int dy) {
    INPUT inputs[2];
    UINT count = 0;

    memset(inputs, 0, sizeof(inputs));
    if (dy != 0) {
        inputs[count].type = INPUT_MOUSE;
        inputs[count].mi.dwFlags = MOUSEEVENTF_WHEEL;
        inputs[count].mi.mouseData = (DWORD)(dy * WHEEL_DELTA);
        count++;
    }
    if (dx != 0) {
        inputs[count].type = INPUT_MOUSE;
        inputs[count].mi.dwFlags = MOUSEEVENTF_HWHEEL;
        inputs[count].mi.mouseData = (DWORD)(dx * WHEEL_DELTA);
        count++;
    }
    if (count == 0) {
        return PCINPUT_OK;
    }
    return send_input_checked(count, inputs, "mouse scroll");
}

static int windows_keyboard_key(pc_key_t key, DWORD flags) {
    WORD code = windows_key_code(key);
    INPUT input;

    if (code == 0) {
        return pc_invalid_argument("unsupported keyboard key");
    }

    memset(&input, 0, sizeof(input));
    input.type = INPUT_KEYBOARD;
    input.ki.wVk = code;
    input.ki.dwFlags = flags;
    return send_input_checked(1, &input, "keyboard key event");
}

static int windows_keyboard_tap(pc_key_t key) {
    WORD code = windows_key_code(key);
    INPUT inputs[2];

    if (code == 0) {
        return pc_invalid_argument("unsupported keyboard key");
    }

    memset(inputs, 0, sizeof(inputs));
    inputs[0].type = INPUT_KEYBOARD;
    inputs[0].ki.wVk = code;
    inputs[1].type = INPUT_KEYBOARD;
    inputs[1].ki.wVk = code;
    inputs[1].ki.dwFlags = KEYEVENTF_KEYUP;
    return send_input_checked(2, inputs, "keyboard key tap");
}

static int windows_keyboard_down(pc_key_t key) {
    return windows_keyboard_key(key, 0);
}

static int windows_keyboard_up(pc_key_t key) {
    return windows_keyboard_key(key, KEYEVENTF_KEYUP);
}

static int windows_keyboard_type_utf8(const char* text) {
    int wide_len;
    WCHAR* wide;
    int i;

    if (text == 0) {
        return pc_invalid_argument("keyboard text pointer is null");
    }
    if (text[0] == '\0') {
        return PCINPUT_OK;
    }

    wide_len = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, text, -1, 0, 0);
    if (wide_len <= 0) {
        pc_set_errorf("UTF-8 to UTF-16 conversion failed with Windows error %lu", GetLastError());
        return PCINPUT_ERR_INVALID_ARGUMENT;
    }

    wide = (WCHAR*)calloc((size_t)wide_len, sizeof(WCHAR));
    if (wide == 0) {
        return pc_backend_error("out of memory while typing text");
    }

    if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, text, -1, wide, wide_len) <= 0) {
        free(wide);
        pc_set_errorf("UTF-8 to UTF-16 conversion failed with Windows error %lu", GetLastError());
        return PCINPUT_ERR_INVALID_ARGUMENT;
    }

    for (i = 0; i < wide_len - 1; i++) {
        INPUT inputs[2];
        memset(inputs, 0, sizeof(inputs));
        inputs[0].type = INPUT_KEYBOARD;
        inputs[0].ki.wScan = wide[i];
        inputs[0].ki.dwFlags = KEYEVENTF_UNICODE;
        inputs[1].type = INPUT_KEYBOARD;
        inputs[1].ki.wScan = wide[i];
        inputs[1].ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
        if (send_input_checked(2, inputs, "keyboard text input") != PCINPUT_OK) {
            free(wide);
            return PCINPUT_ERR_BACKEND;
        }
    }

    free(wide);
    return PCINPUT_OK;
}

static const pc_backend_t g_windows_backend = {
    "windows",
    windows_init,
    windows_shutdown,
    windows_get_capabilities,
    windows_mouse_move_relative,
    windows_mouse_move_absolute,
    windows_mouse_click,
    windows_mouse_scroll,
    windows_keyboard_type_utf8,
    windows_keyboard_tap,
    windows_keyboard_down,
    windows_keyboard_up,
};

const pc_backend_t* pc_windows_backend(void) {
    return &g_windows_backend;
}

#endif
