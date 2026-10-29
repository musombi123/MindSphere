using UnityEngine;
using UnityEngine.EventSystems;

namespace ProjectZeroHour.Player
{
    /// <summary>Right-side drag surface for camera orbit; works independently from the movement joystick.</summary>
    [DisallowMultipleComponent]
    public sealed class PlayerLookPad : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler, ICancelHandler
    {
        [SerializeField] private PlayerInputRouter input;
        private int activePointerId = int.MinValue;

        public void OnPointerDown(PointerEventData eventData)
        {
            if (activePointerId != int.MinValue) return;
            activePointerId = eventData.pointerId;
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (input != null && eventData.pointerId == activePointerId)
                input.AddTouchLookDelta(eventData.delta);
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            if (eventData.pointerId == activePointerId) activePointerId = int.MinValue;
        }

        public void OnCancel(BaseEventData eventData) => activePointerId = int.MinValue;
        private void OnDisable() => activePointerId = int.MinValue;
    }
}
