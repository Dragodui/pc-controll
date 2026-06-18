#ifdef __linux__

#include "pcinput_internal.h"

#include <errno.h>
#include <fcntl.h>
#include <linux/input.h>
#include <linux/uinput.h>
#include <stdio.h>
#include <string.h>
#include <sys/ioctl.h>
#include <unistd.h>

static int g_uinput_fd = -1;

typedef struct linux_text_key {
    int code;
    int shift;
} linux_text_key_t;

static int linux_uinput_emit(int type, int code, int value) {
    struct input_event event;
    ssize_t written;

    memset(&event, 0, sizeof(event));
    event.type = (unsigned short)type;
    event.code = (unsigned short)code;
    event.value = value;

    written = write(g_uinput_fd, &event, sizeof(event));
    if (written != (ssize_t)sizeof(event)) {
        pc_set_errorf("uinput write failed: errno %d", errno);
        return PCINPUT_ERR_BACKEND;
    }
    return PCINPUT_OK;
}

static int linux_uinput_sync(void) {
    return linux_uinput_emit(EV_SYN, SYN_REPORT, 0);
}

static int linux_uinput_emit_key(int code, int pressed) {
    int result = linux_uinput_emit(EV_KEY, code, pressed);
    if (result != PCINPUT_OK) {
        return result;
    }
    return linux_uinput_sync();
}

static int linux_uinput_tap_key_code(int code) {
    int result = linux_uinput_emit_key(code, 1);
    if (result != PCINPUT_OK) {
        return result;
    }
    return linux_uinput_emit_key(code, 0);
}

static int linux_uinput_set_bit(unsigned long request, int value, const char* label) {
    if (ioctl(g_uinput_fd, request, value) < 0) {
        pc_set_errorf("uinput %s setup failed for value %d: errno %d", label, value, errno);
        return PCINPUT_ERR_BACKEND;
    }
    return PCINPUT_OK;
}

static int linux_uinput_key_code(pc_key_t key) {
    switch (key) {
    case PC_KEY_ALT:
        return KEY_LEFTALT;
    case PC_KEY_BACKSPACE:
        return KEY_BACKSPACE;
    case PC_KEY_COMMAND:
        return KEY_LEFTMETA;
    case PC_KEY_ENTER:
        return KEY_ENTER;
    case PC_KEY_SHIFT:
        return KEY_LEFTSHIFT;
    case PC_KEY_SPACE:
        return KEY_SPACE;
    case PC_KEY_TAB:
        return KEY_TAB;
    default:
        return 0;
    }
}

static int linux_uinput_setup_keys(void) {
    int code;
    int result;

    for (code = KEY_ESC; code <= KEY_RIGHTMETA; code++) {
        result = linux_uinput_set_bit(UI_SET_KEYBIT, code, "key");
        if (result != PCINPUT_OK) {
            return result;
        }
    }

    result = linux_uinput_set_bit(UI_SET_KEYBIT, BTN_LEFT, "button");
    if (result != PCINPUT_OK) {
        return result;
    }
    result = linux_uinput_set_bit(UI_SET_KEYBIT, BTN_RIGHT, "button");
    if (result != PCINPUT_OK) {
        return result;
    }
    return linux_uinput_set_bit(UI_SET_KEYBIT, BTN_MIDDLE, "button");
}

static int linux_uinput_init(void) {
    struct uinput_setup setup;
    int result;

    if (g_uinput_fd >= 0) {
        return PCINPUT_OK;
    }

    g_uinput_fd = open("/dev/uinput", O_WRONLY | O_NONBLOCK);
    if (g_uinput_fd < 0) {
        if (errno == EACCES || errno == EPERM) {
            pc_set_error("opening /dev/uinput failed: permission denied");
            return PCINPUT_ERR_PERMISSION;
        }
        pc_set_errorf("opening /dev/uinput failed: errno %d", errno);
        return PCINPUT_ERR_BACKEND;
    }

    result = linux_uinput_set_bit(UI_SET_EVBIT, EV_KEY, "event");
    if (result != PCINPUT_OK) {
        close(g_uinput_fd);
        g_uinput_fd = -1;
        return result;
    }
    result = linux_uinput_set_bit(UI_SET_EVBIT, EV_REL, "event");
    if (result != PCINPUT_OK) {
        close(g_uinput_fd);
        g_uinput_fd = -1;
        return result;
    }
    result = linux_uinput_set_bit(UI_SET_RELBIT, REL_X, "relative axis");
    if (result != PCINPUT_OK) {
        close(g_uinput_fd);
        g_uinput_fd = -1;
        return result;
    }
    result = linux_uinput_set_bit(UI_SET_RELBIT, REL_Y, "relative axis");
    if (result != PCINPUT_OK) {
        close(g_uinput_fd);
        g_uinput_fd = -1;
        return result;
    }
    result = linux_uinput_set_bit(UI_SET_RELBIT, REL_WHEEL, "relative axis");
    if (result != PCINPUT_OK) {
        close(g_uinput_fd);
        g_uinput_fd = -1;
        return result;
    }
    result = linux_uinput_set_bit(UI_SET_RELBIT, REL_HWHEEL, "relative axis");
    if (result != PCINPUT_OK) {
        close(g_uinput_fd);
        g_uinput_fd = -1;
        return result;
    }
    result = linux_uinput_setup_keys();
    if (result != PCINPUT_OK) {
        close(g_uinput_fd);
        g_uinput_fd = -1;
        return result;
    }

    memset(&setup, 0, sizeof(setup));
    snprintf(setup.name, UINPUT_MAX_NAME_SIZE, "pcinput virtual input");
    setup.id.bustype = BUS_USB;
    setup.id.vendor = 0x5050;
    setup.id.product = 0x4349;
    setup.id.version = 1;

    if (ioctl(g_uinput_fd, UI_DEV_SETUP, &setup) < 0) {
        pc_set_errorf("uinput device setup failed: errno %d", errno);
        close(g_uinput_fd);
        g_uinput_fd = -1;
        return PCINPUT_ERR_BACKEND;
    }
    if (ioctl(g_uinput_fd, UI_DEV_CREATE) < 0) {
        pc_set_errorf("uinput device create failed: errno %d", errno);
        close(g_uinput_fd);
        g_uinput_fd = -1;
        return PCINPUT_ERR_BACKEND;
    }

    usleep(100000);
    return PCINPUT_OK;
}

static void linux_uinput_shutdown(void) {
    if (g_uinput_fd >= 0) {
        ioctl(g_uinput_fd, UI_DEV_DESTROY);
        close(g_uinput_fd);
        g_uinput_fd = -1;
    }
}

static int linux_uinput_get_capabilities(pc_caps_t* out) {
    if (out == 0) {
        return pc_invalid_argument("capabilities output pointer is null");
    }

    memset(out, 0, sizeof(*out));
    out->mouse_move_relative = 1;
    out->mouse_move_absolute = 0;
    out->mouse_click = 1;
    out->mouse_scroll = 1;
    out->keyboard_text = 1;
    out->keyboard_keys = 1;
    out->screen_capture = 0;
    out->requires_user_permission = 1;
    out->degraded = 1;
    return PCINPUT_OK;
}

static int linux_uinput_mouse_move_relative(int dx, int dy) {
    int result;

    if (dx != 0) {
        result = linux_uinput_emit(EV_REL, REL_X, dx);
        if (result != PCINPUT_OK) {
            return result;
        }
    }
    if (dy != 0) {
        result = linux_uinput_emit(EV_REL, REL_Y, dy);
        if (result != PCINPUT_OK) {
            return result;
        }
    }
    return linux_uinput_sync();
}

static int linux_uinput_mouse_move_absolute(int x, int y) {
    (void)x;
    (void)y;
    return pc_unsupported("absolute mouse movement");
}

static int linux_uinput_button_code(pc_mouse_button_t button) {
    switch (button) {
    case PC_MOUSE_LEFT:
        return BTN_LEFT;
    case PC_MOUSE_RIGHT:
        return BTN_RIGHT;
    case PC_MOUSE_MIDDLE:
        return BTN_MIDDLE;
    default:
        return 0;
    }
}

static int linux_uinput_mouse_click(pc_mouse_button_t button) {
    int code = linux_uinput_button_code(button);
    int result;

    if (code == 0) {
        return pc_invalid_argument("unsupported mouse button");
    }

    result = linux_uinput_emit_key(code, 1);
    if (result != PCINPUT_OK) {
        return result;
    }
    return linux_uinput_emit_key(code, 0);
}

static int linux_uinput_mouse_scroll(int dx, int dy) {
    int result;

    if (dy != 0) {
        result = linux_uinput_emit(EV_REL, REL_WHEEL, dy);
        if (result != PCINPUT_OK) {
            return result;
        }
    }
    if (dx != 0) {
        result = linux_uinput_emit(EV_REL, REL_HWHEEL, dx);
        if (result != PCINPUT_OK) {
            return result;
        }
    }
    return linux_uinput_sync();
}

static linux_text_key_t linux_uinput_text_key(unsigned char ch) {
    linux_text_key_t key;
    key.code = 0;
    key.shift = 0;

    if (ch >= 'a' && ch <= 'z') {
        key.code = KEY_A + (ch - 'a');
        return key;
    }
    if (ch >= 'A' && ch <= 'Z') {
        key.code = KEY_A + (ch - 'A');
        key.shift = 1;
        return key;
    }
    if (ch >= '1' && ch <= '9') {
        key.code = KEY_1 + (ch - '1');
        return key;
    }

    switch (ch) {
    case '0':
        key.code = KEY_0;
        break;
    case ' ':
        key.code = KEY_SPACE;
        break;
    case '\n':
        key.code = KEY_ENTER;
        break;
    case '\t':
        key.code = KEY_TAB;
        break;
    case '-':
        key.code = KEY_MINUS;
        break;
    case '_':
        key.code = KEY_MINUS;
        key.shift = 1;
        break;
    case '=':
        key.code = KEY_EQUAL;
        break;
    case '+':
        key.code = KEY_EQUAL;
        key.shift = 1;
        break;
    case '[':
        key.code = KEY_LEFTBRACE;
        break;
    case '{':
        key.code = KEY_LEFTBRACE;
        key.shift = 1;
        break;
    case ']':
        key.code = KEY_RIGHTBRACE;
        break;
    case '}':
        key.code = KEY_RIGHTBRACE;
        key.shift = 1;
        break;
    case ';':
        key.code = KEY_SEMICOLON;
        break;
    case ':':
        key.code = KEY_SEMICOLON;
        key.shift = 1;
        break;
    case '\'':
        key.code = KEY_APOSTROPHE;
        break;
    case '"':
        key.code = KEY_APOSTROPHE;
        key.shift = 1;
        break;
    case '`':
        key.code = KEY_GRAVE;
        break;
    case '~':
        key.code = KEY_GRAVE;
        key.shift = 1;
        break;
    case '\\':
        key.code = KEY_BACKSLASH;
        break;
    case '|':
        key.code = KEY_BACKSLASH;
        key.shift = 1;
        break;
    case ',':
        key.code = KEY_COMMA;
        break;
    case '<':
        key.code = KEY_COMMA;
        key.shift = 1;
        break;
    case '.':
        key.code = KEY_DOT;
        break;
    case '>':
        key.code = KEY_DOT;
        key.shift = 1;
        break;
    case '/':
        key.code = KEY_SLASH;
        break;
    case '?':
        key.code = KEY_SLASH;
        key.shift = 1;
        break;
    case '!':
        key.code = KEY_1;
        key.shift = 1;
        break;
    case '@':
        key.code = KEY_2;
        key.shift = 1;
        break;
    case '#':
        key.code = KEY_3;
        key.shift = 1;
        break;
    case '$':
        key.code = KEY_4;
        key.shift = 1;
        break;
    case '%':
        key.code = KEY_5;
        key.shift = 1;
        break;
    case '^':
        key.code = KEY_6;
        key.shift = 1;
        break;
    case '&':
        key.code = KEY_7;
        key.shift = 1;
        break;
    case '*':
        key.code = KEY_8;
        key.shift = 1;
        break;
    case '(':
        key.code = KEY_9;
        key.shift = 1;
        break;
    case ')':
        key.code = KEY_0;
        key.shift = 1;
        break;
    default:
        break;
    }

    return key;
}

static int linux_uinput_keyboard_type_utf8(const char* text) {
    const unsigned char* cursor = (const unsigned char*)text;

    if (text == 0) {
        return pc_invalid_argument("keyboard text pointer is null");
    }

    while (*cursor != '\0') {
        linux_text_key_t key = linux_uinput_text_key(*cursor);
        int result;

        if (key.code == 0) {
            return pc_invalid_argument("uinput text input currently supports only basic ASCII characters");
        }

        if (key.shift) {
            result = linux_uinput_emit_key(KEY_LEFTSHIFT, 1);
            if (result != PCINPUT_OK) {
                return result;
            }
        }

        result = linux_uinput_tap_key_code(key.code);
        if (result != PCINPUT_OK) {
            if (key.shift) {
                linux_uinput_emit_key(KEY_LEFTSHIFT, 0);
            }
            return result;
        }

        if (key.shift) {
            result = linux_uinput_emit_key(KEY_LEFTSHIFT, 0);
            if (result != PCINPUT_OK) {
                return result;
            }
        }

        cursor++;
    }

    return PCINPUT_OK;
}

static int linux_uinput_keyboard_tap(pc_key_t key) {
    int code = linux_uinput_key_code(key);

    if (code == 0) {
        return pc_invalid_argument("unsupported keyboard key");
    }
    return linux_uinput_tap_key_code(code);
}

static int linux_uinput_keyboard_down(pc_key_t key) {
    int code = linux_uinput_key_code(key);

    if (code == 0) {
        return pc_invalid_argument("unsupported keyboard key");
    }
    return linux_uinput_emit_key(code, 1);
}

static int linux_uinput_keyboard_up(pc_key_t key) {
    int code = linux_uinput_key_code(key);

    if (code == 0) {
        return pc_invalid_argument("unsupported keyboard key");
    }
    return linux_uinput_emit_key(code, 0);
}

static const pc_backend_t g_linux_uinput_backend = {
    "linux-uinput",
    linux_uinput_init,
    linux_uinput_shutdown,
    linux_uinput_get_capabilities,
    linux_uinput_mouse_move_relative,
    linux_uinput_mouse_move_absolute,
    linux_uinput_mouse_click,
    linux_uinput_mouse_scroll,
    linux_uinput_keyboard_type_utf8,
    linux_uinput_keyboard_tap,
    linux_uinput_keyboard_down,
    linux_uinput_keyboard_up,
};

const pc_backend_t* pc_linux_uinput_backend(void) {
    return &g_linux_uinput_backend;
}

#endif
