using UnityEngine;
using UnityEngine.EventSystems;

namespace ProjectZeroHour.Player
{
    /// <summary>Drag this UI object to produce normalized movement input.</summary>
    [DisallowMultipleComponent]
    public sealed class PlayerVirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler, ICancelHandler
    {
        [SerializeField] private PlayerInputRouter input;
        [SerializeField] private RectTransform background;
        [SerializeField] private RectTransform knob;
        [SerializeField, Range(0.4f, 1f)] private float movementRadius = 0.85f;

        private int activePointerId = int.MinValue;
        private Vector2 normalizedInput;

        public Vector2 Value => normalizedInput;

        public void OnPointerDown(PointerEventData eventData)
        {
            if (activePointerId != int.MinValue) return;
            activePointerId = eventData.pointerId;
            UpdateValue(eventData);
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (eventData.pointerId == activePointerId) UpdateValue(eventData);
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            if (eventData.pointerId == activePointerId) ResetStick();
        }

        public void OnCancel(BaseEventData eventData) => ResetStick();

        private void UpdateValue(PointerEventData eventData)
        {
            if (background == null || input == null) return;
            Rect rect = background.rect;
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(
                    background, eventData.position, eventData.pressEventCamera, out Vector2 local)) return;

            float radiusX = rect.width * 0.5f;
            float radiusY = rect.height * 0.5f;
            if (radiusX <= 0f || radiusY <= 0f) return;

            normalizedInput = Vector2.ClampMagnitude(new Vector2(local.x / radiusX, local.y / radiusY), 1f);
            input.SetTouchMove(normalizedInput * movementRadius);

            if (knob != null)
                knob.anchoredPosition = new Vector2(normalizedInput.x * radiusX * movementRadius,
                                                    normalizedInput.y * radiusY * movementRadius);
        }

        private void ResetStick()
        {
            activePointerId = int.MinValue;
            normalizedInput = Vector2.zero;
            if (input != null) input.SetTouchMove(Vector2.zero);
            if (knob != null) knob.anchoredPosition = Vector2.zero;
        }

        private void OnDisable() => ResetStick();
    }
}
