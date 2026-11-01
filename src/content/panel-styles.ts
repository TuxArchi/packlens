export const panelStyles = `
:host {
  all: initial;
}

.ytpl-fab,
.ytpl-panel,
.ytpl-panel * {
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.ytpl-fab {
  position: fixed;
  right: 18px;
  bottom: 18px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #2a323d;
  border-radius: 50%;
  background: #0f1115;
  color: #22d3a6;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
  padding: 0;
}

.ytpl-fab:hover {
  transform: translateY(-1px);
  border-color: #22d3a6;
}

.ytpl-fab svg {
  width: 24px;
  height: 24px;
  display: block;
}

.ytpl-panel {
  position: fixed;
  right: 18px;
  bottom: 78px;
  width: 340px;
  max-width: calc(100vw - 36px);
  max-height: min(70vh, 560px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0f1115;
  color: #e8edf4;
  border: 1px solid #2a323d;
  border-radius: 14px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
  font-size: 13px;
  line-height: 1.45;
}

.ytpl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #2a323d;
  background: #161a21;
}

.ytpl-head strong {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #93a1b3;
}

.ytpl-body {
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ytpl-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: #e8edf4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ytpl-channel {
  margin: 4px 0 0;
  font-size: 12px;
  color: #93a1b3;
}

.ytpl-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.ytpl-stat {
  background: #161a21;
  border: 1px solid #2a323d;
  border-radius: 10px;
  padding: 8px;
  min-width: 0;
}

.ytpl-stat-label {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #93a1b3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ytpl-stat-value {
  display: block;
  margin-top: 2px;
  font-size: 14px;
  font-weight: 600;
  color: #e8edf4;
}

.ytpl-section-title {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #93a1b3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ytpl-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ytpl-tag {
  background: #1d232c;
  border: 1px solid #2a323d;
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 11px;
  color: #c8d3e1;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ytpl-empty {
  margin: 0;
  color: #93a1b3;
  font-size: 12px;
}

.ytpl-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #2a323d;
  background: #161a21;
}

.ytpl-link,
.ytpl-copy {
  appearance: none;
  border: 0;
  background: transparent;
  color: #22d3a6;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.ytpl-link:hover,
.ytpl-copy:hover {
  text-decoration: underline;
}

.ytpl-x {
  appearance: none;
  border: 0;
  background: transparent;
  color: #93a1b3;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 4px;
}

.ytpl-x:hover {
  color: #e8edf4;
}

.ytpl-muted {
  color: #93a1b3;
  font-size: 12px;
  margin: 0;
}

.ytpl-hint {
  margin: 0;
  padding: 7px 9px;
  border: 1px solid #4a3a1a;
  background: #241d0f;
  border-radius: 8px;
  color: #f5d58b;
  font-size: 11px;
  line-height: 1.4;
}
`;
