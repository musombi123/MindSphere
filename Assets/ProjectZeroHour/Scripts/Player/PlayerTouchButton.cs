using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;

namespace ProjectZeroHour.Player
{
    /// <summary>
    /// Attach to a raycastable UI Image. Fire/Aim/Sprint are held while pressed; other actions trigger once.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class PlayerTouchButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler, ICancelHandler
    {
        [SerializeField] private PlayerInputRouter input;
        [SerializeField] private PlayerTouchAction action;
        private readonly HashSet<int> pointerIds = new HashSet<int>();

        public void OnPointerDown(PointerEventData eventData)
        {
            if (input == null || !pointerIds.Add(eventData.pointerId)) return;
            if (IsHoldAction(action)) input.SetTouchHold(action, true);
            else input.QueueTouchAction(action);
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            pointerIds.Remove(eventData.pointerId);
            UpdateHoldState();
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            pointerIds.Remove(eventData.pointerId);
            UpdateHoldState();
        }

        public void OnCancel(BaseEventData eventData)
        {
            pointerIds.Clear();
            UpdateHoldState();
        }

        private static bool IsHoldAction(PlayerTouchAction value) =>
            value == PlayerTouchAction.Fire || value == PlayerTouchAction.Aim || value == PlayerTouchAction.Sprint;

        private void UpdateHoldState()
        {
            if (input != null && IsHoldAction(action)) input.SetTouchHold(action, pointerIds.Count > 0);
        }

        private void OnDisable()
        {
            pointerIds.Clear();
            UpdateHoldState();
        }
    }
}
