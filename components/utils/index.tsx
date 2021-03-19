import styled from "@emotion/styled";

// Memotong kalimat jika sudah mencapai maxLine.
// Contoh:
// <Text as={pWithLineClamp(2)} >
//    Hanya akan menampilkan teks sebanyak 2 baris
//    jika melebihi makan akan menampilkan tanda...
//</Text >
export const pWithLineClamp = (maxLine: number) => styled.p`
  display: -webkit-box;
  -webkit-line-clamp: ${maxLine};
  -webkit-box-orient: vertical;
  overflow: hidden;
`;
