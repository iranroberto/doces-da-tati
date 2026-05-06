interface PixPayloadInput {
  key: string;
  amount: number;
  receiverName: string;
  city: string;
  description?: string;
  txid?: string;
}

const tlv = (id: string, value: string) => `${id}${value.length.toString().padStart(2, "0")}${value}`;

const normalizePixText = (value: string, maxLength: number) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 $%*+\-./:]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, maxLength);

const crc16 = (payload: string) => {
  let crc = 0xffff;

  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
};

export const buildPixPayload = ({ key, amount, receiverName, city, description, txid = "PEDIDO" }: PixPayloadInput) => {
  const cleanKey = key.trim();
  if (!cleanKey || amount <= 0) return "";

  const merchantAccount = [
    tlv("00", "br.gov.bcb.pix"),
    tlv("01", cleanKey),
    description ? tlv("02", normalizePixText(description, 72)) : "",
  ].join("");

  const payloadWithoutCrc = [
    tlv("00", "01"),
    tlv("26", merchantAccount),
    tlv("52", "0000"),
    tlv("53", "986"),
    tlv("54", amount.toFixed(2)),
    tlv("58", "BR"),
    tlv("59", normalizePixText(receiverName || "DOCES DA TATI", 25)),
    tlv("60", normalizePixText(city || "RIO DE JANEIRO", 15)),
    tlv("62", tlv("05", normalizePixText(txid, 25) || "PEDIDO")),
    "6304",
  ].join("");

  return `${payloadWithoutCrc}${crc16(payloadWithoutCrc)}`;
};
