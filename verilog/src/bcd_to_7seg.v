/**
 * bcd_to_7seg.v — Decoder BCD (4-bit) ke 7-Segment (a..g) menggunakan persamaan
 * Sum-of-Products (SOP) hasil minimisasi Karnaugh Map (input 10..15 = Don't Care).
 *
 * Output aktif-tinggi (Common Cathode): seg = {a, b, c, d, e, f, g}
 */
module bcd_to_7seg (
    input  wire [3:0] bcd,   // {D3, D2, D1, D0}
    output wire [6:0] seg    // {a, b, c, d, e, f, g}
);
    wire D3 = bcd[3];
    wire D2 = bcd[2];
    wire D1 = bcd[1];
    wire D0 = bcd[0];

    wire a = (~D2 & ~D0) | D1 | (D2 & D0) | D3;
    wire b = ~D2 | (~D1 & ~D0) | (D1 & D0);
    wire c = ~D1 | D0 | D2;
    wire d = (~D2 & ~D0) | (~D2 & D1) | (D2 & ~D1 & D0) | (D1 & ~D0) | D3;
    wire e = (~D2 & ~D0) | (D1 & ~D0);
    wire f = (~D1 & ~D0) | (D2 & ~D1) | (D2 & ~D0) | D3;
    wire g = (~D2 & D1) | (D2 & ~D1) | D3 | (D1 & ~D0);

    assign seg = {a, b, c, d, e, f, g};
endmodule
