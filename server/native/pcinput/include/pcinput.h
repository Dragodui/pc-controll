#ifndef PCINPUT_H
#define PCINPUT_H

#ifdef __cplusplus
extern "C" {
#endif

#define PCINPUT_OK 0
#define PCINPUT_ERR_UNSUPPORTED 1
#define PCINPUT_ERR_PERMISSION 2
#define PCINPUT_ERR_BACKEND 3
#define PCINPUT_ERR_INVALID_ARGUMENT 4
#define PCINPUT_ERR_NOT_INITIALIZED 5

typedef enum pc_mouse_button {
    PC_MOUSE_LEFT = 1,
    PC_MOUSE_RIGHT = 2,
    PC_MOUSE_MIDDLE = 3
} pc_mouse_button_t;

typedef enum pc_key {
    PC_KEY_UNKNOWN = 0,
    PC_KEY_ALT,
    PC_KEY_BACKSPACE,
    PC_KEY_COMMAND,
    PC_KEY_ENTER,
    PC_KEY_SHIFT,
    PC_KEY_SPACE,
    PC_KEY_TAB
} pc_key_t;

typedef struct pc_caps {
    int mouse_move_relative;
    int mouse_move_absolute;
    int mouse_click;
    int mouse_scroll;
    int keyboard_text;
    int keyboard_keys;
    int screen_capture;
    int requires_user_permission;
    int degraded;
} pc_caps_t;

int pc_init(void);
void pc_shutdown(void);

const char* pc_backend_name(void);
int pc_get_capabilities(pc_caps_t* out);
const char* pc_last_error(void);

int pc_mouse_move_relative(int dx, int dy);
int pc_mouse_move_absolute(int x, int y);
int pc_mouse_click(pc_mouse_button_t button);
int pc_mouse_scroll(int dx, int dy);

int pc_keyboard_type_utf8(const char* text);
int pc_keyboard_tap(pc_key_t key);
int pc_keyboard_down(pc_key_t key);
int pc_keyboard_up(pc_key_t key);

#ifdef __cplusplus
}
#endif

#endif
