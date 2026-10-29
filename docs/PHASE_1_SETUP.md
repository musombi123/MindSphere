# Project Zero Hour — Phase 1: Player Controller (Unity 6 LTS / URP)

This pack contains the first phase only. It does **not** implement weapon damage, enemy AI, actual ability effects, mission completion, saves, or the final HUD. Those stay for later phases, so each phase can be tested before adding more systems.

## Contents

Copy the `Assets/ProjectZeroHour/Scripts/Player/` folder into the `Assets` folder of your Unity project.

- `PlayerInputRouter.cs` — new Input System keyboard/mouse/gamepad input and touch input bridge.
- `PlayerVirtualJoystick.cs` — mobile movement joystick.
- `PlayerLookPad.cs` — mobile camera-look drag surface.
- `PlayerTouchButton.cs` — hold/tap buttons for fire, aim, sprint, jump, crouch, reload, abilities and interact.
- `ThirdPersonPlayerController.cs` — CharacterController movement, jump/gravity, crouch clearance check, camera-target orbit and Animator parameter writer.

All scripts are ordinary C# files; no web runtime or online service is used.

## Requirements — install these first

1. Open the project using your installed **Unity 6 LTS** editor and the URP template.
2. Open **Window > Package Management > Package Manager**.
3. Install **Input System** (`com.unity.inputsystem`) from Unity Registry if it is not installed.
4. Install **Cinemachine 3.x** (`com.unity.cinemachine`) from Unity Registry.
5. Open **Edit > Project Settings > Player > Other Settings**. Set **Active Input Handling** to **Input System Package (New)**. Unity may ask to restart the editor. This pack uses `UnityEngine.InputSystem`, not the deprecated `UnityEngine.Input` polling API.
6. Save the scene before wiring the camera and UI.

Use Unity's Cinemachine 3 naming: `Cinemachine Camera`, `Cinemachine Brain`, and `Cinemachine Third Person Follow`. Do not mix Cinemachine 2.x components with this code, which uses the `Unity.Cinemachine` namespace.

## Step 1 — create the player root

1. In the Hierarchy create **Create Empty** and name it `Player`.
2. Set its Transform position to `(0, 0, 0)` and rotation to `(0, 0, 0)`. Keep the root upright; do not rotate it to fit a model's forward axis.
3. Add **Character Controller** to `Player`.
4. Set the Character Controller:
   - Center: `(0, 0.9, 0)`
   - Height: `1.8`
   - Radius: `0.32`
   - Slope Limit: `45`
   - Step Offset: `0.3`
   - Skin Width: about `0.04`
   - Min Move Distance: `0`
5. Create/import your humanoid character as a child of `Player`, named `CharacterModel`. Position its feet at local `Y = 0`, and correct the child rotation/scale if the imported model's forward axis differs. Do **not** put a Rigidbody on the player root.
6. Add an **Animator** to the character model (or use the Animator already on the imported rig). Disable **Apply Root Motion**. Configure the model as Humanoid if you are using Mixamo-style humanoid animations.
7. Use a layer named `Player` for the Player root and model if possible. Ground and obstruction layer masks in the controller should exclude `Player`.

## Step 2 — add the scripts to Player

Add both scripts to the **Player root**:

- `PlayerInputRouter`
- `ThirdPersonPlayerController`

In `ThirdPersonPlayerController`, assign:

| Inspector field | Drag this into it |
|---|---|
| Input | `Player` (the object with `PlayerInputRouter`) |
| Camera Target | the separate `CameraTarget` object created in Step 3 |
| Third Person Follow | the `Cinemachine Third Person Follow` component from the Cinemachine camera object |
| Animator | the Animator component on `CharacterModel` |
| Walk Speed | `2.2` |
| Run Speed | `4.4` |
| Sprint Speed | `6.0` |
| Crouch Speed | `1.45` |
| Standing Height | `1.8` |
| Crouching Height | `1.15` |
| Ground Mask | Ground, Terrain and Environment layers only; exclude Player |
| Obstruction Mask | Solid world/ceiling layers only; exclude Player |
| Hip Camera Distance | `4.2` |
| Aim Camera Distance | `2.45` |
| Weapon Hold Layer Index | `1` if you create that Animator layer; otherwise `-1` |
| Aim Shoot Layer Index | `2` if you create that Animator layer; otherwise `-1` |

Keep the default sensitivities initially. Tune after testing on an actual phone.

## Step 3 — create the Cinemachine third-person camera

Cinemachine 3's third-person follower places the camera behind a tracking target and inherits that target's rotation. This controller rotates a separate invisible target so camera orbit is independent of player movement. See Unity's official [Cinemachine Third Person Follow guide](https://docs.unity.cn/Packages/com.unity.cinemachine@3.1/manual/CinemachineThirdPersonFollow.html).

1. Select the `Main Camera`. Add **Cinemachine Brain** if it is missing.
2. Create a separate empty GameObject at the scene root called `CameraTarget`. It can initially be at `(0, 1.48, 0)`. Do **not** parent it under `Player`; the script will position and rotate it.
3. Choose **GameObject > Cinemachine > Cinemachine Camera** (or the third-person camera option if your package exposes it).
4. On the Cinemachine camera, set **Tracking Target** to `CameraTarget`.
5. Add **Cinemachine Third Person Follow** to the Cinemachine camera object and select it as the camera's Position Control behavior. If the camera menu already added it, reuse it rather than adding a duplicate.
6. Initial Third Person Follow values:
   - Shoulder Offset: `(0.48, 0.16, 0)`
   - Vertical Arm Length: `0.35`
   - Camera Side: `1`
   - Camera Distance: `4.2`
   - Damping: `(0.08, 0.12, 0.08)`
   - Enable its obstacle-avoidance/camera-collision option.
   - Camera collision mask: Environment, Ground, Terrain and other world geometry; exclude Player.
   - Ignore Tag: `Player` if you assign the Player tag.
7. Back on `Player > Third Person Player Controller`, drag the **Cinemachine Third Person Follow component**, not just the camera Transform, into `Third Person Follow`.
8. Keep `CameraTarget`'s own Transform free for the controller to drive.

Do not add a second camera-follow script that writes the Main Camera Transform; Cinemachine owns the render camera pose.

## Step 4 — build the Animator Controller

The scripts are tolerant of missing Animator parameters, so you can test movement before building every animation state. For the full locomotion/weapon setup, create `POH_Player.controller` and assign it to the model Animator.

### Base Layer

Create these parameters exactly:

| Name | Type | Purpose |
|---|---|---|
| `MoveX` | Float | Local strafe direction |
| `MoveY` | Float | Local forward/back direction |
| `Speed` | Float | Normalized planar speed |
| `Grounded` | Bool | Grounded state |
| `VerticalVelocity` | Float | Rising/falling state |
| `IsSprinting` | Bool | Sprint locomotion |
| `IsCrouching` | Bool | Crouch state |
| `IsAiming` | Bool | Aim state |
| `IsFiring` | Bool | Fire held |
| `Jump` | Trigger | Start jump |
| `Land` | Trigger | Landing reaction |
| `Fire` | Trigger | Fire animation |
| `Reload` | Trigger | Reload animation |
| `Shockwave` | Trigger | Ability animation hook |
| `Aegis` | Trigger | Ability animation hook |
| `Overdrive` | Trigger | Ability animation hook |
| `ChainLightning` | Trigger | Ability animation hook |
| `SecondWind` | Trigger | Ability animation hook |
| `Interact` | Trigger | Interact animation hook |

Create a **2D Freeform Directional** Blend Tree or **2D Freeform Cartesian** Blend Tree with `MoveX` and `MoveY`. Add your available idle, forward walk/run, left/right strafe, and backwards clips at their corresponding coordinates. For a simpler initial test, a 1D Blend Tree using `Speed` with Idle at `0`, Walk around `0.35`, Run at `0.72`, and Sprint at `1` is sufficient. Use only clips whose rig/avatar is compatible with the model.

Add jump/fall/land transitions from the base state as desired. The controller triggers `Jump` on accepted jumps and `Land` on a grounded transition. Use `Grounded` and `VerticalVelocity` to help choose landing/falling transitions.

### Weapon Hold layer — index 1

1. Add a layer named `WeaponHold` as layer index **1**.
2. Create an Avatar Mask limited to upper body (spine/chest/arms/hands) and assign it to that layer.
3. Add your Mixamo-style rifle/weapon idle or weapon-hold clip as its default state.
4. Set the layer's blending to Override or your chosen compatible upper-body blend mode.
5. The controller keeps this layer at weight `1`. If you do not yet have weapon-hold clips, set **Weapon Hold Layer Index** to `-1`.

### Aim/Shoot layer — index 2

1. Add a layer named `AimShoot` as layer index **2**, and assign an upper-body Avatar Mask.
2. Create an aimed/weapon-ready idle state. Use `IsAiming` to transition to and from it.
3. Add your shoot clip. Transition into it with the `Fire` trigger; use exit time to return to aim idle.
4. The script fades this layer's weight to `1` while aim or fire is held and to `0` when neither is held.
5. Set **Aim Shoot Layer Index** to `-1` until layer index 2 exists.

All animator state/transition names are yours to choose. The parameter names above are the script contract. The ability/reload/interact triggers currently just reach the Animator; actual gameplay effects are intentionally implemented in later phases.

## Step 5 — create the mobile touch UI

Create a **Canvas** named `TouchControlsCanvas`.

1. Render Mode: **Screen Space - Overlay**.
2. Add **Canvas Scaler**:
   - UI Scale Mode: `Scale With Screen Size`
   - Reference Resolution: `1920 × 1080`
   - Screen Match Mode: `Match Width Or Height`
   - Match: `0.5`
3. Make sure the scene has an **EventSystem** with **InputSystemUIInputModule** (not only the legacy Standalone Input Module). Creating a UI button via the Unity UI menu usually creates an EventSystem automatically; replace its module if needed.
4. Create a left-side `JoystickBackground` (Image), anchored at bottom-left. Suggested size `220 × 220`, offset `(150, 145)`.
   - Add a child Image named `JoystickKnob`, size `92 × 92`, anchored at center.
   - Add `PlayerVirtualJoystick` to `JoystickBackground`.
   - Assign `Input` = Player's `PlayerInputRouter`; `Background` = `JoystickBackground` RectTransform; `Knob` = `JoystickKnob` RectTransform.
   - Keep the joystick background Image's **Raycast Target** enabled.
5. Create a transparent `LookPad` Image covering most of the right half, anchored right/stretch (roughly from 42% width to 100%, 12% to 92% height).
   - Set its Image alpha nearly transparent (e.g. `0.01`) but keep **Raycast Target** enabled.
   - Add `PlayerLookPad`; assign `Input` = Player's `PlayerInputRouter`.
   - Place this object before the right-side buttons in the Canvas hierarchy so the buttons receive touches on top of it.
6. For each touch button, create a UI Image, add `PlayerTouchButton`, and drag the Player's `PlayerInputRouter` into `Input`. Select the matching **Action** in the dropdown. Add a child Text or TextMeshPro label for visibility; the label can have Raycast Target disabled so the Image receives input.

Create these buttons and assign their Actions:

| UI label | `PlayerTouchAction` | Behaviour |
|---|---|---|
| Fire | `Fire` | Held while pressed |
| Aim | `Aim` | Held while pressed |
| Sprint | `Sprint` | Held while pressed |
| Jump | `Jump` | One-shot on press |
| Crouch | `CrouchToggle` | Toggle on press |
| Reload (R) | `Reload` | One-shot |
| Shockwave (Q) | `Shockwave` | One-shot |
| Aegis (E) | `Aegis` | One-shot |
| Overdrive (F) | `Overdrive` | One-shot |
| Chain Lightning (C) | `ChainLightning` | One-shot |
| Second Wind (X) | `SecondWind` | One-shot |
| Interact (G) | `Interact` | One-shot |

Suggested mobile layout: joystick lower-left; camera-look pad covering the remaining central/right touch area; Jump, Crouch and Sprint near right-lower corner; Fire and Aim near right-middle; reload and ability buttons in a smaller row/cluster at the right edge. Leave room for the Android bottom gesture/navigation area. Adjust anchors at a few aspect ratios.

The touch script uses Unity UI pointer events, so one finger can move the joystick while another drags the look pad or presses Fire. If there is no UI touch layer in a PC test scene, keyboard/mouse/gamepad still work.

## Step 6 — keyboard and gamepad map for testing

| Action | Keyboard/mouse | Gamepad |
|---|---|---|
| Move | `W A S D` | Left stick |
| Look | Mouse movement | Right stick |
| Fire | Left mouse button | Right trigger |
| Aim | Right mouse button | Left trigger |
| Sprint | Left Shift | Left-stick click |
| Jump | Space | South / A button |
| Crouch toggle | Left Ctrl (Caps Lock fallback) | East / B button |
| Reload | R | West / X button |
| Shockwave | Q | D-pad Up |
| Aegis | E | D-pad Right |
| Overdrive | F | D-pad Down |
| Chain Lightning | C | Left shoulder / LB |
| Second Wind | X | Right shoulder / RB |
| Interact | G | North / Y button |

Note: this is a starter key map, not the final remapping/settings system. A physical controller is optional; keyboard/mouse testing works with no extra assets.

## Step 7 — add a floor and test in Play mode

1. Create a Plane named `TestGround`, position `(0, -0.1, 0)`, scale `(10, 1, 10)`. Make sure it has a collider and its layer is included by `Ground Mask` / `Obstruction Mask`.
2. Put `Player` at `(0, 0, 0)`. Make sure the capsule bottom meets the floor.
3. Assign all references in the Inspector and press Play.
4. In the Game view test `WASD`, mouse look, left mouse fire, right mouse aim, Space jump, Left Ctrl crouch, Shift sprint, and the Q/E/F/C/X/R/G commands.
5. Test the UI joystick and look pad in Play Mode using the mouse; on a touch device use two fingers to verify movement + camera look simultaneously.
6. The controls should work without a weapon, enemy, sound, or ability effect. Phase 1 only writes Animator triggers for these actions. Phase 2 and Phase 4 will connect them to actual weapons and abilities.
7. Confirm the Cinemachine camera does not clip through a wall: place a box/cube obstacle behind and beside the player and move close to it. If it clips, re-check the Third Person Follow avoidance option and collision mask.
8. Test crouch beneath a low ceiling; the controller should stay crouched if the clearance test blocks standing.

## What to report before Phase 2

Please test the above in your Unity editor and send me:
- Any first red Console error (copy the complete message and line).
- Whether keyboard movement, mouse orbit, aim camera shift, jump, crouch and sprint all work.
- Whether the touch joystick/look pad/buttons work with two simultaneous fingers.
- Your installed Unity editor and Cinemachine package versions (from Help > About Unity and Package Manager).

Do not build the Android APK yet. This phase is for editor wiring and Play Mode verification.

## Free/licensed asset policy for this phase

No external asset is included in this script pack. The C# code is original project code. Use your own character/animations or import appropriately licensed Mixamo-compatible animations; check the current terms of the chosen source and include required attribution in the project's asset credits. Do not use PUBG models, logos, sounds or other proprietary game assets.
