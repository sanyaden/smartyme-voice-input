# Flutter App Microphone Support - Required Changes

## Overview
To enable microphone support for voice input in the Flutter WebView, only **3 files** need to be modified. The changes are minimal and maintain full compatibility with the existing codebase.

## Complete List of Changes

### 1. WebView Configuration (Dart Code)
**File**: `lib/smarty_me/app/features/end_of_lesson_placement/web_view_bottom_sheet.dart`

Add these parameters to the InAppWebView widget (line 73):

```dart
child: InAppWebView(
  initialUrlRequest: URLRequest(url: WebUri(url)),
  // ADD THESE LINES:
  initialSettings: InAppWebViewSettings(
    javaScriptEnabled: true,
    mediaPlaybackRequiresUserGesture: false,
    allowsInlineMediaPlayback: true,
    iframeAllow: "camera; microphone",
    iframeAllowFullscreen: true,
  ),
  onPermissionRequest: (controller, request) async {
    // Grant all permissions including microphone
    return PermissionResponse(
      resources: request.resources,
      action: PermissionResponseAction.GRANT,
    );
  },
  // EXISTING CODE CONTINUES:
  gestureRecognizers: {
    // ... existing gesture recognizers
  },
),
```

### 2. iOS Permission
**File**: `ios/Runner/Info.plist`

Add this permission description after line 68 (after NSUserTrackingUsageDescription):

```xml
<key>NSMicrophoneUsageDescription</key>
<string>This app needs access to the microphone for voice input in chat conversations.</string>
```

### 3. Android Permissions
**File**: `android/app/src/main/AndroidManifest.xml`

Add these permissions after line 9 (after RECEIVE_BOOT_COMPLETED):

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
```

## That's It! ✅

No other changes are required. The modified app (`mega-app-with-mic`) is available in the current directory for reference.

## How to Apply These Changes

1. Open your Flutter project in your IDE
2. Navigate to each of the 3 files listed above
3. Add the specified code snippets
4. Run `flutter clean` and `flutter pub get`
5. Build and test on both iOS and Android

## Testing Checklist

- [ ] iOS: App requests microphone permission on first voice input attempt
- [ ] iOS: Voice input works in WebView after permission granted
- [ ] Android: App requests microphone permission when needed
- [ ] Android: Voice input works in WebView after permission granted
- [ ] Both platforms: Users can type if they deny microphone permission

## Notes for Developers

- The `registration_screen.dart` already has correct permissions (can be used as reference)
- No Flutter package updates required
- No JavaScript changes needed in the web app
- The web app already handles permission denials gracefully

## Files Location Reference

```
mega-app/
├── lib/smarty_me/app/features/
│   └── end_of_lesson_placement/
│       └── web_view_bottom_sheet.dart  ← Modify this
├── ios/Runner/
│   └── Info.plist                      ← Add iOS permission
└── android/app/src/main/
    └── AndroidManifest.xml              ← Add Android permissions
```