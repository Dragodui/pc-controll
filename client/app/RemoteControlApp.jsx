import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Slider from "@react-native-community/slider";
import {
    GestureDetector,
    GestureHandlerRootView,
} from "react-native-gesture-handler";
import {
    ChevronLeft,
    Keyboard as KeyboardIcon,
    Languages,
    Monitor,
    Plus,
    Search,
    Settings,
    Trash2,
} from "lucide-react-native";

import { styles } from "./styles";
import { useRemoteControl } from "./useRemoteControl";

export default function RemoteControlApp() {
    const app = useRemoteControl();

    if (app.currentScreen === "list") {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <View style={styles.listHeader}>
                    <Text style={styles.mainTitle}>Devices</Text>
                    <TouchableOpacity
                        onPress={app.smartScan}
                        disabled={app.isScanning}
                    >
                        {app.isScanning ? (
                            <ActivityIndicator color="#007AFF" />
                        ) : (
                            <Search color="#007AFF" size={28} />
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.scroll}>
                    {app.devices.map((dev) => (
                        <TouchableOpacity
                            key={dev.id}
                            style={styles.devCard}
                            onPress={() => app.handleDevicePress(dev)}
                        >
                            <View style={styles.devInfo}>
                                <Monitor
                                    color={dev.online ? "#00ff00" : "#444"}
                                    size={30}
                                />
                                <View style={{ marginLeft: 15 }}>
                                    <Text style={styles.devNameText}>
                                        {dev.name}
                                    </Text>
                                    <Text style={styles.devIpText}>
                                        {dev.ip}:{dev.port}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => app.removeDevice(dev.id)}
                            >
                                <Trash2 color="#ff3b30" size={22} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => app.setAddModalVisible(true)}
                >
                    <Plus color="#fff" size={32} />
                </TouchableOpacity>

                <Modal
                    visible={app.isPassPromptVisible}
                    animationType="fade"
                    transparent
                >
                    <View style={styles.modalFull}>
                        <View style={styles.modalBox}>
                            <Text style={styles.modalLabel}>
                                ENTER PASSWORD FOR {app.tempDevice?.name}
                            </Text>
                            <TextInput
                                style={styles.input}
                                secureTextEntry
                                value={app.promptPass}
                                onChangeText={app.setPromptPass}
                                autoFocus
                            />
                            <TouchableOpacity
                                style={[
                                    styles.mBtn,
                                    {
                                        backgroundColor: "#007AFF",
                                        width: "100%",
                                    },
                                ]}
                                onPress={app.savePasswordAndConnect}
                            >
                                <Text
                                    style={{
                                        color: "#fff",
                                        fontWeight: "bold",
                                    }}
                                >
                                    CONNECT
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                <Modal
                    visible={app.isAddModalVisible}
                    animationType="slide"
                    transparent
                >
                    <View style={styles.modalFull}>
                        <View style={styles.modalBox}>
                            <TextInput
                                style={styles.input}
                                placeholder="IP"
                                value={app.newIp}
                                onChangeText={app.setNewIp}
                                keyboardType="numeric"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Port"
                                value={app.newPort}
                                onChangeText={app.setNewPort}
                                keyboardType="numeric"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Pass"
                                value={app.newPass}
                                onChangeText={app.setNewPass}
                                secureTextEntry
                            />
                            <TouchableOpacity
                                style={[
                                    styles.mBtn,
                                    {
                                        backgroundColor: "#007AFF",
                                        width: "100%",
                                    },
                                ]}
                                onPress={app.addManualDevice}
                            >
                                <Text
                                    style={{
                                        color: "#fff",
                                        fontWeight: "bold",
                                    }}
                                >
                                    ADD
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    return (
        <>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <StatusBar barStyle="light-content" />
                    <View style={styles.headerControl}>
                        <TouchableOpacity onPress={app.disconnectToList}>
                            <ChevronLeft color="#fff" size={32} />
                        </TouchableOpacity>
                        <View style={{ alignItems: "center" }}>
                            <Text style={styles.brand}>
                                {app.activeDevice?.name}
                            </Text>
                            <Text
                                style={[
                                    styles.statusSmall,
                                    {
                                        color:
                                            app.status === "Connected"
                                                ? "#00ff00"
                                                : "#ff4444",
                                    },
                                ]}
                            >
                                {app.status}
                            </Text>
                        </View>
                        <View style={{ flexDirection: "row" }}>
                            <TouchableOpacity
                                onPress={app.switchLang}
                                style={{ marginRight: 20 }}
                            >
                                <Languages color="#fff" size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => app.inputRef.current?.focus()}
                                style={{ marginRight: 20 }}
                            >
                                <KeyboardIcon color="#fff" size={24} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => app.setSensModalVisible(true)}
                            >
                                <Settings color="#fff" size={24} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TextInput
                        ref={app.inputRef}
                        style={styles.hiddenInput}
                        onChangeText={app.handleType}
                        onKeyPress={(event) => {
                            if (event.nativeEvent.key === "Backspace")
                                app.send({ type: "tap", key: "backspace" });
                            if (event.nativeEvent.key === "Enter")
                                app.send({ type: "tap", key: "enter" });
                        }}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />

                    <GestureDetector gesture={app.trackpadGesture}>
                        <View style={styles.touchpad}>
                            <Monitor color="#0a0a0a" size={120} />
                        </View>
                    </GestureDetector>

                    <View style={styles.bottomPanel}>
                        <GestureDetector gesture={app.switcherGesture}>
                            <View style={styles.switchBar}>
                                <Text style={styles.btnText}>ALT + TAB</Text>
                            </View>
                        </GestureDetector>

                        <TouchableOpacity
                            onPress={() =>
                                app.send({ type: "tap", key: "enter" })
                            }
                        >
                            <View style={styles.switchBar}>
                                <Text style={styles.btnText}>Enter</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </GestureHandlerRootView>

            <Modal
                visible={app.isSensModalVisible}
                animationType="fade"
                transparent
                onRequestClose={() => app.setSensModalVisible(false)}
            >
                <View style={styles.modalFull}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalLabel}>
                            SENSITIVITY: {app.sensitivity.toFixed(1)}x
                        </Text>
                        <Slider
                            style={{ width: "100%", height: 40 }}
                            minimumValue={0.5}
                            maximumValue={5}
                            step={0.1}
                            value={app.sensitivity}
                            onValueChange={app.setSensitivity}
                            onSlidingComplete={app.persistSetting(
                                "sensitivity",
                            )}
                            minimumTrackTintColor="#007AFF"
                        />

                        <Text style={styles.modalLabel}>
                            SCROLL SPEED: {app.scrollSensitivity.toFixed(1)}x
                        </Text>
                        <Slider
                            style={{ width: "100%", height: 40 }}
                            minimumValue={0.1}
                            maximumValue={3}
                            step={0.1}
                            value={app.scrollSensitivity}
                            onValueChange={app.setScrollSensitivity}
                            onSlidingComplete={app.persistSetting(
                                "scrollSensitivity",
                            )}
                            minimumTrackTintColor="#007AFF"
                        />

                        <Text style={styles.modalLabel}>
                            SMOOTHING: {app.smoothFactor.toFixed(2)}
                        </Text>
                        <Slider
                            style={{ width: "100%", height: 40 }}
                            minimumValue={0}
                            maximumValue={0.9}
                            step={0.05}
                            value={app.smoothFactor}
                            onValueChange={app.setSmoothFactor}
                            onSlidingComplete={app.persistSetting(
                                "smoothFactor",
                            )}
                            minimumTrackTintColor="#007AFF"
                        />
                        <TouchableOpacity
                            style={[
                                styles.mBtn,
                                {
                                    backgroundColor: "#007AFF",
                                    width: "100%",
                                    marginTop: 20,
                                },
                            ]}
                            onPress={() => app.setSensModalVisible(false)}
                        >
                            <Text style={{ color: "#fff", fontWeight: "bold" }}>
                                DONE
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}
