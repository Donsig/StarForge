import type { CardType } from '../../utils/cardDetails';

export function LeftColumn({ card }: { card: { type: CardType; id: string } }) {
  return (
    <aside className="card-detail-modal__left" data-card-type={card.type} data-card-id={card.id}>
      Left column placeholder
    </aside>
  );
}
