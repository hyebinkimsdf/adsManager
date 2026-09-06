"use client";

import { type ReactNode, useEffect } from "react";
import { HiXMark } from "react-icons/hi2";
import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const slideInRight = keyframes`
  from {
    opacity: 0;
    transform: translateX(16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
`;

const Backdrop = styled.div`
  position: absolute;
  inset: 0;
  background-color: rgba(25, 31, 40, 0.3);
  animation: ${fadeInUp} 0.22s ease-out both;
`;

const Panel = styled.div`
  position: absolute;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.float};
  animation: ${slideInRight} 0.24s cubic-bezier(0.16, 1, 0.3, 1) both;

  inset-inline: 0;
  bottom: 0;
  max-height: 85vh;
  border-top-left-radius: ${({ theme }) => theme.radius.lg};
  border-top-right-radius: ${({ theme }) => theme.radius.lg};

  @media (min-width: 640px) {
    inset-block: 0;
    right: 0;
    left: auto;
    bottom: auto;
    height: 100%;
    max-height: none;
    width: 420px;
    border-top-right-radius: 0;
    border-top-left-radius: ${({ theme }) => theme.radius.lg};
    border-bottom-left-radius: ${({ theme }) => theme.radius.lg};
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  padding: 1rem 1.25rem;
`;

const PanelTitle = styled.h2`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.gray[900]};
`;

const CloseButton = styled.button`
  display: flex;
  height: 2rem;
  width: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.full};
  color: ${({ theme }) => theme.colors.gray[500]};

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray[100]};
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.blue[500]};
  }
`;

const PanelBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
`;

const PanelFooter = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  padding: 1rem;
`;

export function SlideOver({ open, onClose, title, children, footer }: SlideOverProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Overlay>
      <Backdrop onClick={onClose} aria-hidden="true" />
      <Panel role="dialog" aria-modal="true" aria-label={title}>
        <PanelHeader>
          <PanelTitle>{title}</PanelTitle>
          <CloseButton type="button" onClick={onClose} aria-label="닫기">
            <HiXMark style={{ height: "1.25rem", width: "1.25rem" }} aria-hidden="true" />
          </CloseButton>
        </PanelHeader>
        <PanelBody>{children}</PanelBody>
        {footer && <PanelFooter>{footer}</PanelFooter>}
      </Panel>
    </Overlay>
  );
}
