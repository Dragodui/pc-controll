#ifdef __APPLE__

#include "pcinput_internal.h"

#include <ApplicationServices/ApplicationServices.h>

#include <stdint.h>
#include <string.h>

/* Virtual key codes from HIToolbox/Events.h (kVK_*). */
#define MACOS_VK_RETURN 0x24
#define MACOS_VK_TAB 0x30
#define MACOS_VK_SPACE 0x31
#define MACOS_VK_DELETE 0x33 /* backspace */
#define MACOS_VK_COMMAND 0x37
#define MACOS_VK_SHIFT 0x38

/* CGEventKeyboardSetUnicodeString accepts at most 20 UTF-16 units per event. */
#define MACOS_UNICODE_CHUNK 20

/* Modifiers currently held through keyboard_down. CGEventPost does not
 * reliably carry modifier state across separately posted events, so held
 * modifiers are re-applied to every event flags field. */
static CGEventFlags g_macos_held_flags = 0;

/* PC_KEY_ALT maps to Command: the client uses Alt+Tab for window switching,
 * which is Cmd+Tab on macOS. Option has no equivalent role. */
static CGKeyCode macos_key_code(pc_key_t key) {
    switch (key) {
    case PC_KEY_ALT:
        return MACOS_VK_COMMAND;
    case PC_KEY_BACKSPACE:
        return MACOS_VK_DELETE;
    case PC_KEY_COMMAND:
        return MACOS_VK_COMMAND;
    case PC_KEY_ENTER:
        return MACOS_VK_RETURN;
    case PC_KEY_SHIFT:
        return MACOS_VK_SHIFT;
    case PC_KEY_SPACE:
        return MACOS_VK_SPACE;
    case PC_KEY_TAB:
        return MACOS_VK_TAB;
    default:
        return 0xFFFF;
    }
}

static CGEventFlags macos_modifier_flag(pc_key_t key) {
    switch (key) {
    case PC_KEY_ALT:
        return kCGEventFlagMaskCommand;
    case PC_KEY_COMMAND:
        return kCGEventFlagMaskCommand;
    case PC_KEY_SHIFT:
        return kCGEventFlagMaskShift;
    default:
        return 0;
    }
}

static int macos_post(CGEventRef event, const char* operation) {
    if (event == NULL) {
        pc_set_errorf("%s failed: could not create CGEvent", operation);
        return PCINPUT_ERR_BACKEND;
    }
    CGEventSetFlags(event, CGEventGetFlags(event) | g_macos_held_flags);
    CGEventPost(kCGHIDEventTap, event);
    CFRelease(event);
    return PCINPUT_OK;
}

static CGPoint macos_cursor_position(void) {
    CGEventRef event = CGEventCreate(NULL);
    CGPoint point;
    if (event == NULL) {
        point.x = 0;
        point.y = 0;
        return point;
    }
    point = CGEventGetLocation(event);
    CFRelease(event);
    return point;
}

static int macos_init(void) {
    CFStringRef keys[1];
    CFTypeRef values[1];
    CFDictionaryRef options;
    Boolean trusted;

    if (AXIsProcessTrusted()) {
        return PCINPUT_OK;
    }

    /* Ask macOS to show the "allow this app to control your computer" prompt. */
    keys[0] = kAXTrustedCheckOptionPrompt;
    values[0] = kCFBooleanTrue;
    options = CFDictionaryCreate(kCFAllocatorDefault, (const void**)keys, (const void**)values, 1,
                                 &kCFTypeDictionaryKeyCallBacks, &kCFTypeDictionaryValueCallBacks);
    trusted = AXIsProcessTrustedWithOptions(options);
    if (options != NULL) {
        CFRelease(options);
    }
    if (trusted) {
        return PCINPUT_OK;
    }

    pc_set_error("Accessibility permission denied: enable this app in System Settings > "
                 "Privacy & Security > Accessibility, then restart the server");
    return PCINPUT_ERR_PERMISSION;
}

static void macos_shutdown(void) {
    g_macos_held_flags = 0;
}

static int macos_get_capabilities(pc_caps_t* out) {
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
    out->requires_user_permission = 1;
    out->degraded = 0;
    return PCINPUT_OK;
}

static int macos_move_to(CGPoint point, int dx, int dy) {
    CGEventRef event = CGEventCreateMouseEvent(NULL, kCGEventMouseMoved, point, kCGMouseButtonLeft);
    if (event == NULL) {
        return pc_backend_error("mouse movement failed: could not create CGEvent");
    }
    /* Games and some apps read deltas instead of absolute position. */
    CGEventSetIntegerValueField(event, kCGMouseEventDeltaX, dx);
    CGEventSetIntegerValueField(event, kCGMouseEventDeltaY, dy);
    return macos_post(event, "mouse movement");
}

static int macos_mouse_move_relative(int dx, int dy) {
    CGPoint point = macos_cursor_position();
    point.x += dx;
    point.y += dy;
    /* The window server pins the cursor to the displays; the next call reads the pinned position. */
    return macos_move_to(point, dx, dy);
}

static int macos_mouse_move_absolute(int x, int y) {
    CGPoint point;
    point.x = x;
    point.y = y;
    return macos_move_to(point, 0, 0);
}

static int macos_mouse_click(pc_mouse_button_t button) {
    CGEventType down_type;
    CGEventType up_type;
    CGMouseButton cg_button;
    CGPoint point;
    int result;

    switch (button) {
    case PC_MOUSE_LEFT:
        down_type = kCGEventLeftMouseDown;
        up_type = kCGEventLeftMouseUp;
        cg_button = kCGMouseButtonLeft;
        break;
    case PC_MOUSE_RIGHT:
        down_type = kCGEventRightMouseDown;
        up_type = kCGEventRightMouseUp;
        cg_button = kCGMouseButtonRight;
        break;
    case PC_MOUSE_MIDDLE:
        down_type = kCGEventOtherMouseDown;
        up_type = kCGEventOtherMouseUp;
        cg_button = kCGMouseButtonCenter;
        break;
    default:
        return pc_invalid_argument("unsupported mouse button");
    }

    point = macos_cursor_position();
    result = macos_post(CGEventCreateMouseEvent(NULL, down_type, point, cg_button), "mouse button down");
    if (result != PCINPUT_OK) {
        return result;
    }
    return macos_post(CGEventCreateMouseEvent(NULL, up_type, point, cg_button), "mouse button up");
}

static int macos_mouse_scroll(int dx, int dy) {
    CGEventRef event;

    if (dx == 0 && dy == 0) {
        return PCINPUT_OK;
    }
    /* Axis 1 is vertical, axis 2 horizontal; positive scrolls up/left like the other backends. */
    event = CGEventCreateScrollWheelEvent(NULL, kCGScrollEventUnitLine, 2, (int32_t)dy, (int32_t)dx);
    return macos_post(event, "mouse scroll");
}

static int macos_keyboard_key(pc_key_t key, int down) {
    CGKeyCode code = macos_key_code(key);
    CGEventFlags modifier;
    int result;

    if (code == 0xFFFF) {
        return pc_invalid_argument("unsupported keyboard key");
    }

    modifier = macos_modifier_flag(key);
    if (modifier != 0 && !down) {
        /* Clear before posting so the key-up event itself does not carry the flag. */
        g_macos_held_flags &= ~modifier;
    }

    result = macos_post(CGEventCreateKeyboardEvent(NULL, code, down ? true : false), "keyboard key event");
    if (result != PCINPUT_OK) {
        return result;
    }

    if (modifier != 0 && down) {
        g_macos_held_flags |= modifier;
    }
    return PCINPUT_OK;
}

static int macos_keyboard_tap(pc_key_t key) {
    int result = macos_keyboard_key(key, 1);
    if (result != PCINPUT_OK) {
        return result;
    }
    return macos_keyboard_key(key, 0);
}

static int macos_keyboard_down(pc_key_t key) {
    return macos_keyboard_key(key, 1);
}

static int macos_keyboard_up(pc_key_t key) {
    return macos_keyboard_key(key, 0);
}

/* Decode one UTF-8 sequence. Returns bytes consumed, 0 on malformed input. */
static int macos_utf8_decode(const unsigned char* s, uint32_t* out) {
    if (s[0] < 0x80) {
        *out = s[0];
        return 1;
    }
    if ((s[0] & 0xE0) == 0xC0 && (s[1] & 0xC0) == 0x80) {
        *out = ((uint32_t)(s[0] & 0x1F) << 6) | (s[1] & 0x3F);
        return 2;
    }
    if ((s[0] & 0xF0) == 0xE0 && (s[1] & 0xC0) == 0x80 && (s[2] & 0xC0) == 0x80) {
        *out = ((uint32_t)(s[0] & 0x0F) << 12) | ((uint32_t)(s[1] & 0x3F) << 6) | (s[2] & 0x3F);
        return 3;
    }
    if ((s[0] & 0xF8) == 0xF0 && (s[1] & 0xC0) == 0x80 && (s[2] & 0xC0) == 0x80 && (s[3] & 0xC0) == 0x80) {
        *out = ((uint32_t)(s[0] & 0x07) << 18) | ((uint32_t)(s[1] & 0x3F) << 12) |
               ((uint32_t)(s[2] & 0x3F) << 6) | (s[3] & 0x3F);
        return 4;
    }
    return 0;
}

static int macos_post_unicode_chunk(const UniChar* units, UniCharCount count) {
    CGEventRef event;
    int result;

    event = CGEventCreateKeyboardEvent(NULL, 0, true);
    if (event == NULL) {
        return pc_backend_error("keyboard text input failed: could not create CGEvent");
    }
    CGEventKeyboardSetUnicodeString(event, count, units);
    result = macos_post(event, "keyboard text input");
    if (result != PCINPUT_OK) {
        return result;
    }

    event = CGEventCreateKeyboardEvent(NULL, 0, false);
    if (event == NULL) {
        return pc_backend_error("keyboard text input failed: could not create CGEvent");
    }
    CGEventKeyboardSetUnicodeString(event, count, units);
    return macos_post(event, "keyboard text input");
}

/* Types arbitrary Unicode text directly; no clipboard and no layout dependency. */
static int macos_keyboard_type_utf8(const char* text) {
    const unsigned char* cursor;
    UniChar chunk[MACOS_UNICODE_CHUNK];
    UniCharCount filled = 0;

    if (text == 0) {
        return pc_invalid_argument("keyboard text pointer is null");
    }

    cursor = (const unsigned char*)text;
    while (*cursor != '\0') {
        uint32_t code_point;
        int consumed = macos_utf8_decode(cursor, &code_point);
        if (consumed == 0) {
            return pc_invalid_argument("keyboard text is not valid UTF-8");
        }
        cursor += consumed;

        /* Flush before a code point that would not fit (surrogate pairs need two units). */
        if (filled + (code_point > 0xFFFF ? 2 : 1) > MACOS_UNICODE_CHUNK) {
            int result = macos_post_unicode_chunk(chunk, filled);
            if (result != PCINPUT_OK) {
                return result;
            }
            filled = 0;
        }

        if (code_point > 0xFFFF) {
            code_point -= 0x10000;
            chunk[filled++] = (UniChar)(0xD800 | (code_point >> 10));
            chunk[filled++] = (UniChar)(0xDC00 | (code_point & 0x3FF));
        } else {
            chunk[filled++] = (UniChar)code_point;
        }
    }

    if (filled > 0) {
        return macos_post_unicode_chunk(chunk, filled);
    }
    return PCINPUT_OK;
}

static const pc_backend_t g_macos_backend = {
    "macos",
    macos_init,
    macos_shutdown,
    macos_get_capabilities,
    macos_mouse_move_relative,
    macos_mouse_move_absolute,
    macos_mouse_click,
    macos_mouse_scroll,
    macos_keyboard_type_utf8,
    macos_keyboard_tap,
    macos_keyboard_down,
    macos_keyboard_up,
};

const pc_backend_t* pc_macos_backend(void) {
    return &g_macos_backend;
}

#endif
