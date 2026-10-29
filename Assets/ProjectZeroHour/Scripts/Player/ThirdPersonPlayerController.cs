using System.Collections.Generic;
using UnityEngine;
using Unity.Cinemachine;

namespace ProjectZeroHour.Player
{
    /// <summary>
    /// Offline third-person locomotion starter for Project Zero Hour.
    /// Owns CharacterController movement, camera-target rotation and an Animator parameter contract.
    /// Weapon damage, ability effects, HUD data and mission state are left for their later phases.
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(CharacterController))]
    public sealed class ThirdPersonPlayerController : MonoBehaviour
    {
        [Header("Required references")]
        [SerializeField] private PlayerInputRouter input;
        [SerializeField] private Transform cameraTarget;
        [SerializeField] private CinemachineThirdPersonFollow thirdPersonFollow;
        [SerializeField] private Animator animator;
        [Header("Movement (metres per second)")]
        [SerializeField, Min(0f)] private float walkSpeed = 2.2f;
        [SerializeField, Min(0f)] private float runSpeed = 4.4f;
        [SerializeField, Min(0f)] private float sprintSpeed = 6f;
        [SerializeField, Min(0f)] private float crouchSpeed = 1.45f;
        [SerializeField, Min(0.1f)] private float turnSharpness = 14f;

        [Header("Jump and gravity")]
        [SerializeField, Min(0f)] private float jumpHeight = 1.15f;
        [SerializeField, Min(0.1f)] private float gravity = 22f;
        [Tooltip("Include ground/world layers. Exclude the Player layer.")]
        [SerializeField] private LayerMask groundMask = ~0;
        [SerializeField, Min(0.01f)] private float groundedProbeDistance = 0.18f;

        [Header("Crouch")]
        [SerializeField, Min(0.5f)] private float standingHeight = 1.8f;
        [SerializeField, Min(0.5f)] private float crouchingHeight = 1.15f;
        [SerializeField, Min(0.1f)] private float crouchTransitionSpeed = 7f;
        [Tooltip("Include solid world/ceiling layers. Exclude the Player layer.")]
        [SerializeField] private LayerMask obstructionMask = ~0;

        [Header("Third-person camera")]
        [SerializeField, Min(0.1f)] private float cameraTargetHeight = 1.48f;
        [SerializeField, Range(-35f, 0f)] private float minimumPitch = -30f;
        [SerializeField, Range(0f, 80f)] private float maximumPitch = 60f;
        [SerializeField, Min(0.1f)] private float hipCameraDistance = 4.2f;
        [SerializeField, Min(0.1f)] private float aimCameraDistance = 2.45f;
        [SerializeField] private Vector3 hipShoulderOffset = new Vector3(0.48f, 0.16f, 0f);
        [SerializeField] private Vector3 aimShoulderOffset = new Vector3(0.62f, 0.08f, 0f);
        [SerializeField, Min(0.1f)] private float cameraModeBlendSpeed = 8f;

        [Header("Animator layer indices (-1 disables a layer)")]
        [SerializeField] private int weaponHoldLayerIndex = 1;
        [SerializeField] private int aimShootLayerIndex = 2;
        [SerializeField, Min(0.1f)] private float aimLayerBlendSpeed = 10f;
        [SerializeField, Min(0.01f)] private float animatorDampTime = 0.10f;

        private CharacterController characterController;
        private float verticalVelocity;
        private float cameraYaw;
        private float cameraPitch;
        private float smoothedSpeed;
        private Vector2 localMove;
        private bool crouching;
        private bool sprinting;
        private bool wasGrounded;
        private bool previousFireHeld;
        private bool hasMovedOnce;
        private readonly HashSet<int> floatParameters = new HashSet<int>();
        private readonly HashSet<int> boolParameters = new HashSet<int>();
        private readonly HashSet<int> triggerParameters = new HashSet<int>();
        private float currentAimWeight;
        private float currentCameraDistance;
        private Vector3 currentShoulderOffset;

        private static readonly int MoveXHash = Animator.StringToHash("MoveX");
        private static readonly int MoveYHash = Animator.StringToHash("MoveY");
        private static readonly int SpeedHash = Animator.StringToHash("Speed");
        private static readonly int GroundedHash = Animator.StringToHash("Grounded");
        private static readonly int VerticalVelocityHash = Animator.StringToHash("VerticalVelocity");
        private static readonly int SprintHash = Animator.StringToHash("IsSprinting");
        private static readonly int CrouchHash = Animator.StringToHash("IsCrouching");
        private static readonly int AimHash = Animator.StringToHash("IsAiming");
        private static readonly int FireHeldHash = Animator.StringToHash("IsFiring");

        private void Awake()
        {
            characterController = GetComponent<CharacterController>();
            if (input == null) input = GetComponent<PlayerInputRouter>();

            if (characterController != null)
            {
                float minimumHeight = characterController.radius * 2f + 0.02f;
                characterController.height = Mathf.Max(standingHeight, minimumHeight);
                characterController.center = new Vector3(0f, characterController.height * 0.5f, 0f);
            }

            CacheAnimatorParameters();
            cameraYaw = transform.eulerAngles.y;
            cameraPitch = 8f;
            currentCameraDistance = hipCameraDistance;
            currentShoulderOffset = hipShoulderOffset;

            if (cameraTarget == null)
                Debug.LogError("[Project Zero Hour] Assign Camera Target and set the Cinemachine Camera Tracking Target to it.", this);
            if (input == null)
                Debug.LogError("[Project Zero Hour] PlayerInputRouter is missing. Add it to the player root.", this);
        }

        private void Update()
        {
            if (input == null || characterController == null) return;

            float dt = Time.deltaTime;
            ReadLookInput();
            ReadCommands();
            UpdateCrouch(dt);
            MoveCharacter(dt);
            UpdateAnimator(dt);
        }

        private void LateUpdate()
        {
            if (cameraTarget != null)
            {
                // A separate target lets the camera orbit while the character is moving/aiming independently.
                cameraTarget.position = transform.position + Vector3.up * cameraTargetHeight;
                cameraTarget.rotation = Quaternion.Euler(cameraPitch, cameraYaw, 0f);
            }

            if (thirdPersonFollow != null)
            {
                bool aiming = input != null && input.AimHeld;
                float desiredDistance = aiming ? aimCameraDistance : hipCameraDistance;
                Vector3 desiredOffset = aiming ? aimShoulderOffset : hipShoulderOffset;
                float blend = 1f - Mathf.Exp(-cameraModeBlendSpeed * Time.deltaTime);
                currentCameraDistance = Mathf.Lerp(currentCameraDistance, desiredDistance, blend);
                currentShoulderOffset = Vector3.Lerp(currentShoulderOffset, desiredOffset, blend);
                thirdPersonFollow.CameraDistance = currentCameraDistance;
                thirdPersonFollow.ShoulderOffset = currentShoulderOffset;
            }

            if (animator != null)
            {
                if (aimShootLayerIndex >= 0 && aimShootLayerIndex < animator.layerCount)
                {
                    float target = input != null && (input.AimHeld || input.FireHeld) ? 1f : 0f;
                    currentAimWeight = Mathf.MoveTowards(currentAimWeight, target, aimLayerBlendSpeed * Time.deltaTime);
                    animator.SetLayerWeight(aimShootLayerIndex, currentAimWeight);
                }

                if (weaponHoldLayerIndex >= 0 && weaponHoldLayerIndex < animator.layerCount)
                    animator.SetLayerWeight(weaponHoldLayerIndex, 1f);
            }
        }

        private void ReadLookInput()
        {
            Vector2 look = input.ConsumeLookDelta();
            cameraYaw += look.x;
            // Mouse/touch screen Y is inverted into camera pitch: dragging up looks up.
            cameraPitch = Mathf.Clamp(cameraPitch - look.y, minimumPitch, maximumPitch);
        }

        private void ReadCommands()
        {
            if (input.ConsumeCommand(PlayerCommand.CrouchToggle)) crouching = !crouching;

            if (input.ConsumeCommand(PlayerCommand.Jump) && IsGrounded())
            {
                verticalVelocity = Mathf.Sqrt(2f * gravity * jumpHeight);
                Trigger("Jump");
            }

            if (input.ConsumeCommand(PlayerCommand.Reload)) Trigger("Reload");
            if (input.ConsumeCommand(PlayerCommand.Shockwave)) Trigger("Shockwave");
            if (input.ConsumeCommand(PlayerCommand.Aegis)) Trigger("Aegis");
            if (input.ConsumeCommand(PlayerCommand.Overdrive)) Trigger("Overdrive");
            if (input.ConsumeCommand(PlayerCommand.ChainLightning)) Trigger("ChainLightning");
            if (input.ConsumeCommand(PlayerCommand.SecondWind)) Trigger("SecondWind");
            if (input.ConsumeCommand(PlayerCommand.Interact)) Trigger("Interact");

            bool firing = input.FireHeld;
            if (firing && !previousFireHeld) Trigger("Fire");
            previousFireHeld = firing;
        }

        private void MoveCharacter(float dt)
        {
            bool groundedBeforeMove = IsGrounded();
            if (groundedBeforeMove && verticalVelocity < 0f) verticalVelocity = -2f;
            else verticalVelocity -= gravity * dt;

            Vector2 moveInput = Vector2.ClampMagnitude(input.Move, 1f);
            Quaternion cameraYawRotation = Quaternion.Euler(0f, cameraYaw, 0f);
            Vector3 forward = cameraYawRotation * Vector3.forward;
            Vector3 right = cameraYawRotation * Vector3.right;
            Vector3 wishDirection = forward * moveInput.y + right * moveInput.x;
            if (wishDirection.sqrMagnitude > 1f) wishDirection.Normalize();

            sprinting = input.SprintHeld && !crouching && moveInput.y > 0.1f;
            float inputMagnitude = moveInput.magnitude;
            float selectedSpeed = crouching ? crouchSpeed :
                                  sprinting ? sprintSpeed :
                                  inputMagnitude > 0.58f ? runSpeed : walkSpeed;
            float speed = selectedSpeed * inputMagnitude;

            Vector3 planarVelocity = wishDirection * speed;
            characterController.Move((planarVelocity + Vector3.up * verticalVelocity) * dt);

            bool groundedAfterMove = IsGrounded();
            if (hasMovedOnce && !wasGrounded && groundedAfterMove) Trigger("Land");
            wasGrounded = groundedAfterMove;
            hasMovedOnce = true;

            // In aim mode the body turns toward the camera even when moving sideways/backward.
            Vector3 facing = input.AimHeld ? forward : wishDirection;
            if (facing.sqrMagnitude > 0.001f)
            {
                Quaternion targetRotation = Quaternion.LookRotation(facing, Vector3.up);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation,
                    1f - Mathf.Exp(-turnSharpness * dt));
            }

            localMove = transform.InverseTransformDirection(wishDirection);
            smoothedSpeed = Mathf.Lerp(smoothedSpeed, planarVelocity.magnitude, 1f - Mathf.Exp(-12f * dt));
        }

        private bool IsGrounded()
        {
            if (characterController == null) return false;
            if (characterController.isGrounded) return true;

            Vector3 origin = transform.position + Vector3.up * (characterController.radius + 0.04f);
            float distance = Mathf.Max(groundedProbeDistance, characterController.skinWidth + 0.04f);
            return Physics.SphereCast(origin, characterController.radius * 0.88f, Vector3.down,
                out _, distance, groundMask, QueryTriggerInteraction.Ignore);
        }

        private void UpdateCrouch(float dt)
        {
            float targetHeight = crouching ? crouchingHeight : standingHeight;
            if (!crouching && characterController.height < standingHeight - 0.05f)
            {
                Vector3 bottom = transform.position + Vector3.up * (characterController.radius + 0.03f);
                Vector3 top = transform.position + Vector3.up * (standingHeight - characterController.radius);
                if (Physics.CheckCapsule(bottom, top, characterController.radius * 0.92f,
                    obstructionMask, QueryTriggerInteraction.Ignore))
                {
                    crouching = true;
                    targetHeight = crouchingHeight;
                }
            }

            characterController.height = Mathf.MoveTowards(characterController.height, targetHeight, crouchTransitionSpeed * dt);
            characterController.center = new Vector3(0f, characterController.height * 0.5f, 0f);
        }

        private void UpdateAnimator(float dt)
        {
            if (animator == null) return;

            float denominator = Mathf.Max(0.01f, sprinting ? sprintSpeed : runSpeed);
            SetFloat(MoveXHash, localMove.x, animatorDampTime);
            SetFloat(MoveYHash, localMove.z, animatorDampTime);
            SetFloat(SpeedHash, smoothedSpeed / denominator, animatorDampTime);
            SetBool(GroundedHash, IsGrounded());
            SetFloat(VerticalVelocityHash, verticalVelocity, animatorDampTime);
            SetBool(SprintHash, sprinting);
            SetBool(CrouchHash, crouching);
            SetBool(AimHash, input.AimHeld);
            SetBool(FireHeldHash, input.FireHeld);
        }

        private void CacheAnimatorParameters()
        {
            floatParameters.Clear();
            boolParameters.Clear();
            triggerParameters.Clear();
            if (animator == null) return;

            foreach (AnimatorControllerParameter parameter in animator.parameters)
            {
                switch (parameter.type)
                {
                    case AnimatorControllerParameterType.Float: floatParameters.Add(parameter.nameHash); break;
                    case AnimatorControllerParameterType.Bool: boolParameters.Add(parameter.nameHash); break;
                    case AnimatorControllerParameterType.Trigger: triggerParameters.Add(parameter.nameHash); break;
                }
            }
        }

        private void Trigger(string parameterName)
        {
            if (animator != null && triggerParameters.Contains(Animator.StringToHash(parameterName)))
                animator.SetTrigger(parameterName);
        }

        private void SetFloat(int hash, float value, float dampTime)
        {
            if (animator != null && floatParameters.Contains(hash))
                animator.SetFloat(hash, value, dampTime, Time.deltaTime);
        }

        private void SetBool(int hash, bool value)
        {
            if (animator != null && boolParameters.Contains(hash)) animator.SetBool(hash, value);
        }

#if UNITY_EDITOR
        private void OnDrawGizmosSelected()
        {
            Gizmos.color = new Color(0.2f, 0.85f, 1f, 0.8f);
            Vector3 targetPosition = transform.position + Vector3.up * cameraTargetHeight;
            Gizmos.DrawWireSphere(targetPosition, 0.08f);
            Gizmos.DrawLine(transform.position, targetPosition);
        }
#endif
    }
}
