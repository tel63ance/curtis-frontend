// components/KeyBoardAvoidingWrapper.js
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  View,
} from "react-native";

// Arboretum Inspired Color Palette
const ArboretumColors = {
  forestGreen: "#2B5F3B", // Deep forest green
  mossGreen: "#4A7856", // Soft moss
  oliveGreen: "#6A8D73", // Olive green
  sageGreen: "#8AA99B", // Sage green
  barkBrown: "#5D4A3A", // Tree bark
  earthBrown: "#7C5E4A", // Rich earth
  sandBeige: "#D4B68A", // Sandy path
  stoneGray: "#9BA5A9", // Stone
  mistGray: "#E5E9E7", // Morning mist
  skyBlue: "#87AFC7", // Sky through trees
  sunYellow: "#E6B450", // Dappled sunlight
  clayRed: "#B76E5A", // Red earth/clay
  leafGreen: "#9FB88B", // New leaves
  barkLight: "#8B7355", // Light bark
  white: "#FFFFFF",
  black: "#2C3E2B",
};

const KeyboardAvoidingWrapper = ({
  children,
  backgroundColor = ArboretumColors.sageGreen,
}) => {
  return (
    <KeyboardAvoidingView
      style={{
        flex: 1,
        backgroundColor: backgroundColor,
      }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>{children}</View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default KeyboardAvoidingWrapper;
