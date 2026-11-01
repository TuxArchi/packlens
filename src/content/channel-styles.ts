import { panelStyles } from './panel-styles';

export const channelStyles = `${panelStyles}
.ytpl-channel-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  background: #161a21;
  border: 1px solid #2a323d;
  border-radius: 10px;
}

.ytpl-channel-head strong {
  font-size: 13px;
  color: #e8edf4;
}

.ytpl-channel-head span {
  font-size: 11px;
  color: #93a1b3;
}

.ytpl-outlier-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ytpl-outlier {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 9px;
  background: #161a21;
  border: 1px solid #2a323d;
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
}

.ytpl-outlier:hover {
  border-color: #22d3a6;
}

.ytpl-rank {
  flex: 0 0 auto;
  width: 14px;
  padding-top: 2px;
  text-align: right;
  font-size: 10px;
  color: #93a1b3;
  font-variant-numeric: tabular-nums;
}

.ytpl-outlier-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ytpl-outlier-title {
  font-size: 12px;
  line-height: 1.35;
  color: #e8edf4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ytpl-outlier-meta {
  font-size: 10px;
  color: #93a1b3;
}

.ytpl-badge {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  background: #1d232c;
  border: 1px solid #2a323d;
  color: #93a1b3;
  font-variant-numeric: tabular-nums;
}

.ytpl-badge.is-hot {
  background: #34d399;
  border-color: #34d399;
  color: #0f1115;
}

.ytpl-badge.is-warm {
  background: rgba(34, 211, 166, 0.12);
  border-color: rgba(34, 211, 166, 0.4);
  color: #22d3a6;
}

.ytpl-note {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: #93a1b3;
}
`;
