import { Ticket, badge, code, initials, sla, transcript } from './data';

const H = 3600e3;
const t = (p: Partial<Ticket>) => ({ id: 7, priority: 'Alta', status: 'Aberto', createdAt: Date.now(), updatedAt: Date.now(), ...p }) as Ticket;

describe('data helpers', () => {
  it('formats ticket codes with the A- prefix', () => {
    expect(code({ id: 7 })).toBe('A-007');
    expect(code({ id: 1234 })).toBe('A-1234');
  });

  it('computes SLA for open and closed tickets', () => {
    expect(sla(t({ createdAt: Date.now() - 2 * H })).label).toBe('Restam 6 h');
    expect(sla(t({ createdAt: Date.now() - 10 * H })).late).toBe(true);
    expect(sla(t({ status: 'Resolvido', createdAt: 0, resolvedAt: 5 * H })).label).toBe('Cumprido');
    expect(sla(t({ status: 'Fechado', createdAt: 0, resolvedAt: 9 * H })).label).toBe('Violado');
  });

  it('builds a full, ordered transcript including notes, events and attachments', () => {
    const text = transcript(
      t({
        title: 'Erro no PJe', company: 'LexFinance', system: 'LexHub', requester: 'Carla', assignee: 'Ana Rocha', description: 'Timeout',
        log: [{ at: 2000, text: 'Chamado atribuído a Ana Rocha' }],
        messages: [
          { author: 'Carla', body: 'Está dando timeout', at: 1000, via: 'WhatsApp' },
          { author: 'Ana Rocha', body: 'Verificar certificado', at: 3000, internal: true },
          { author: 'Carla', body: '', at: 4000, via: 'WhatsApp', files: [{ name: 'print.png', type: 'image/png', size: 1, url: '' }] },
        ],
      }),
    );
    expect(text).toContain('TRANSCRIÇÃO DO CHAMADO A-007');
    expect(text).toContain('Carla (via WhatsApp):\nEstá dando timeout');
    expect(text).toContain('Ana Rocha [NOTA INTERNA]:');
    expect(text).toContain('📎 Anexo: print.png');
    expect(text.indexOf('Está dando timeout')).toBeLessThan(text.indexOf('atribuído'));
    expect(text.indexOf('atribuído')).toBeLessThan(text.indexOf('NOTA INTERNA'));
    expect(text).toContain('3 mensagens, 1 eventos');
  });

  it('builds badge classes and initials', () => {
    expect(badge('Média')).toBe('badge b-media');
    expect(badge('Aguardando cliente')).toBe('badge b-aguardando-cliente');
    expect(initials('Carla — LexFinance')).toBe('CL');
  });
});
