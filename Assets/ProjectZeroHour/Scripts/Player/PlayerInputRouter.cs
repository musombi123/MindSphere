using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;

namespace ProjectZeroHour.Player
{
    /// <summary>
    /// One input source for keyboard/mouse, gamepad and the mobile touch UI.
    /// Uses the new Unity Input System package, not the legacy Input Manager.
    /// One-shot commands are consumed by the controller so button taps are not lost.
    /// </summary>
    public enum PlayerCommand
    {
        Jump, CrouchToggle, Reload, Shockwave, Aegis, Overdrive,
        ChainLightning, SecondWind, Interact
    }

    public enum PlayerTouchAction
    {
        Fire, Aim, Sprint, Jump, CrouchToggle, Reload, Shockwave,
        Aegis, Overdrive, ChainLightning, SecondWind, Interact
    }

    [DefaultExecutionOrder(-100)]
    [DisallowMultipleComponent]
    public sealed class PlayerInputRouter : MonoBehaviour
    {
        [Header("Look sensitivity")]
        [SerializeField, Min(0.001f)] private float mouseSensitivity = 0.10f;
        [SerializeField, Min(1f)] private float gamepadLookDegreesPerSecond = 150f;
        [SerializeField, Min(0.001f)] private float touchLookSensitivity = 0.12f;

        [Header("Input dead zones")]
        [SerializeField, Range(0f, 0.5f)] private float stickDeadZone = 0.15f;

        private readonly HashSet<PlayerCommand> queuedCommands = new HashSet<PlayerCommand>();
        private Vector2 touchMove;
        private Vector2 touchLookDelta;
        private Vector2 move;
        private Vector2 lookDelta;
        private bool touchFire;
        private bool touchAim;
        private bool touchSprint;
        private bool keyboardFire;
        private bool keyboardAim;
        private bool keyboardSprint;
        private bool gamepadFire;
        private bool gamepadAim;
        private bool gamepadSprint;
        private bool touchInputEnabled = true;

        public Vector2 Move => move;
        public bool FireHeld => touchFire || keyboardFire || gamepadFire;
        public bool AimHeld => touchAim || keyboardAim || gamepadAim;
        public bool SprintHeld => touchSprint || keyboardSprint || gamepadSprint;

        /// <summary>Call once per frame from the player controller to retrieve accumulated look input.</summary>
        public Vector2 ConsumeLookDelta()
        {
            Vector2 value = lookDelta;
            lookDelta = Vector2.zero;
            return value;
        }

        private void Update()
        {
            Keyboard keyboard = Keyboard.current;
            Mouse mouse = Mouse.current;
            Gamepad gamepad = Gamepad.current;

            Vector2 keyboardMove = Vector2.zero;
            if (keyboard != null)
            {
                keyboardMove.x = (keyboard.dKey.isPressed ? 1f : 0f) - (keyboard.aKey.isPressed ? 1f : 0f);
                keyboardMove.y = (keyboard.wKey.isPressed ? 1f : 0f) - (keyboard.sKey.isPressed ? 1f : 0f);
                if (keyboardMove.sqrMagnitude > 1f) keyboardMove.Normalize();
                QueueKeyboardCommands(keyboard);
                keyboardSprint = keyboard.leftShiftKey.isPressed || keyboard.rightShiftKey.isPressed;
                keyboardFire = mouse != null && mouse.leftButton.isPressed;
                keyboardAim = mouse != null && mouse.rightButton.isPressed;
            }
            else
            {
                keyboardSprint = keyboardFire = keyboardAim = false;
            }

            Vector2 gamepadMove = gamepad != null ? gamepad.leftStick.ReadValue() : Vector2.zero;
            if (gamepadMove.magnitude < stickDeadZone) gamepadMove = Vector2.zero;

            move = touchInputEnabled && touchMove.sqrMagnitude > 0.001f
                ? Vector2.ClampMagnitude(touchMove, 1f)
                : gamepadMove.sqrMagnitude > 0.001f
                    ? Vector2.ClampMagnitude(gamepadMove, 1f)
                    : keyboardMove;

            lookDelta = mouse != null ? mouse.delta.ReadValue() * mouseSensitivity : Vector2.zero;
            if (gamepad != null)
            {
                Vector2 stick = gamepad.rightStick.ReadValue();
                if (stick.magnitude < stickDeadZone) stick = Vector2.zero;
                lookDelta += stick * (gamepadLookDegreesPerSecond * Time.unscaledDeltaTime);
                gamepadFire = gamepad.rightTrigger.ReadValue() > 0.25f;
                gamepadAim = gamepad.leftTrigger.ReadValue() > 0.20f;
                gamepadSprint = gamepad.leftStickButton.isPressed;
                QueueGamepadCommands(gamepad);
            }
            else
            {
                gamepadFire = gamepadAim = gamepadSprint = false;
            }

            if (touchInputEnabled) lookDelta += touchLookDelta * touchLookSensitivity;
            touchLookDelta = Vector2.zero;
        }

        private void QueueKeyboardCommands(Keyboard keyboard)
        {
            if (keyboard.spaceKey.wasPressedThisFrame) QueueCommand(PlayerCommand.Jump);
            if (keyboard.leftCtrlKey.wasPressedThisFrame || keyboard.capsLockKey.wasPressedThisFrame) QueueCommand(PlayerCommand.CrouchToggle);
            if (keyboard.rKey.wasPressedThisFrame) QueueCommand(PlayerCommand.Reload);
            if (keyboard.qKey.wasPressedThisFrame) QueueCommand(PlayerCommand.Shockwave);
            if (keyboard.eKey.wasPressedThisFrame) QueueCommand(PlayerCommand.Aegis);
            if (keyboard.fKey.wasPressedThisFrame) QueueCommand(PlayerCommand.Overdrive);
            if (keyboard.cKey.wasPressedThisFrame) QueueCommand(PlayerCommand.ChainLightning);
            if (keyboard.xKey.wasPressedThisFrame) QueueCommand(PlayerCommand.SecondWind);
            if (keyboard.gKey.wasPressedThisFrame) QueueCommand(PlayerCommand.Interact);
        }

        private void QueueGamepadCommands(Gamepad pad)
        {
            if (pad.buttonSouth.wasPressedThisFrame) QueueCommand(PlayerCommand.Jump);
            if (pad.buttonEast.wasPressedThisFrame) QueueCommand(PlayerCommand.CrouchToggle);
            if (pad.buttonWest.wasPressedThisFrame) QueueCommand(PlayerCommand.Reload);
            if (pad.dpad.up.wasPressedThisFrame) QueueCommand(PlayerCommand.Shockwave);
            if (pad.dpad.right.wasPressedThisFrame) QueueCommand(PlayerCommand.Aegis);
            if (pad.dpad.down.wasPressedThisFrame) QueueCommand(PlayerCommand.Overdrive);
            if (pad.leftShoulder.wasPressedThisFrame) QueueCommand(PlayerCommand.ChainLightning);
            if (pad.rightShoulder.wasPressedThisFrame) QueueCommand(PlayerCommand.SecondWind);
            if (pad.buttonNorth.wasPressedThisFrame) QueueCommand(PlayerCommand.Interact);
        }

        public void QueueCommand(PlayerCommand command) => queuedCommands.Add(command);
        public bool ConsumeCommand(PlayerCommand command) => queuedCommands.Remove(command);
        public void SetTouchMove(Vector2 value) => touchMove = Vector2.ClampMagnitude(value, 1f);
        public void AddTouchLookDelta(Vector2 pixelDelta) => touchLookDelta += pixelDelta;

        public void SetTouchHold(PlayerTouchAction action, bool held)
        {
            switch (action)
            {
                case PlayerTouchAction.Fire: touchFire = held; break;
                case PlayerTouchAction.Aim: touchAim = held; break;
                case PlayerTouchAction.Sprint: touchSprint = held; break;
            }
        }

        public void QueueTouchAction(PlayerTouchAction action)
        {
            switch (action)
            {
                case PlayerTouchAction.Jump: QueueCommand(PlayerCommand.Jump); break;
                case PlayerTouchAction.CrouchToggle: QueueCommand(PlayerCommand.CrouchToggle); break;
                case PlayerTouchAction.Reload: QueueCommand(PlayerCommand.Reload); break;
                case PlayerTouchAction.Shockwave: QueueCommand(PlayerCommand.Shockwave); break;
                case PlayerTouchAction.Aegis: QueueCommand(PlayerCommand.Aegis); break;
                case PlayerTouchAction.Overdrive: QueueCommand(PlayerCommand.Overdrive); break;
                case PlayerTouchAction.ChainLightning: QueueCommand(PlayerCommand.ChainLightning); break;
                case PlayerTouchAction.SecondWind: QueueCommand(PlayerCommand.SecondWind); break;
                case PlayerTouchAction.Interact: QueueCommand(PlayerCommand.Interact); break;
            }
        }

        public void SetTouchInputEnabled(bool enabled)
        {
            touchInputEnabled = enabled;
            if (!enabled)
            {
                touchMove = Vector2.zero;
                touchLookDelta = Vector2.zero;
                touchFire = touchAim = touchSprint = false;
            }
        }

        private void OnDisable()
        {
            touchMove = touchLookDelta = Vector2.zero;
            touchFire = touchAim = touchSprint = false;
            queuedCommands.Clear();
        }
    }
}
