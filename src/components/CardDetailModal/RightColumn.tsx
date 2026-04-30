import type { CardType } from '../../utils/cardDetails';

export function RightColumn({ card }: { card: { type: CardType; id: string } }) {
  return (
    <section className="card-detail-modal__right" data-card-type={card.type} data-card-id={card.id}>
      Right column placeholder
    </section>
  );
}
