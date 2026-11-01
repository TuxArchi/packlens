import { formatCheckValue } from '../../core/format';
import { t } from '../../core/i18n';
import type { CheckResult } from '../../core/types';

export function CheckList({ checks }: { checks: CheckResult[] }) {
  return (
    <ul class="check-list">
      {checks.map((check) => (
        <li class={`check check-${check.status}`} key={check.id}>
          <div class="check-head">
            <span class="check-dot" aria-hidden="true" />
            <span class="check-name">{t(`check.${check.id}.name`)}</span>
            <span class="check-value">{formatCheckValue(check)}</span>
          </div>
          {check.status !== 'good' && <p class="check-hint">{t(`check.${check.id}.hint`)}</p>}
        </li>
      ))}
    </ul>
  );
}
