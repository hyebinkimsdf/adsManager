"use client";

import styled from "@emotion/styled";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

const Track = styled.button<{ $checked: boolean }>`
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  height: 1.75rem;
  width: 3rem;
  border-radius: ${({ theme }) => theme.radius.full};
  transition: background-color ${({ theme }) => theme.motion.duration.fast};
  background-color: ${({ theme, $checked }) => ($checked ? theme.colors.blue[500] : theme.colors.gray[200])};

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px white, 0 0 0 4px ${({ theme }) => theme.colors.blue[500]};
  }

  &:disabled {
    opacity: 0.5;
  }
`;

const Thumb = styled.span<{ $checked: boolean }>`
  display: inline-block;
  height: 1.25rem;
  width: 1.25rem;
  border-radius: ${({ theme }) => theme.radius.full};
  background-color: white;
  box-shadow: ${({ theme }) => theme.shadow.card};
  transition: transform ${({ theme }) => theme.motion.duration.fast};
  transform: translateX(${({ $checked }) => ($checked ? "1.5rem" : "0.25rem")});
`;

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <Track
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      $checked={checked}
    >
      <Thumb $checked={checked} />
    </Track>
  );
}
