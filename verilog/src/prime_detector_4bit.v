/**
 * prime_detector_4bit.v — Detektor bilangan prima 4-bit (m = 2, 3, 5, 7, 11, 13)
 * hasil sintesis otomatis K-Map Studio:
 *   Y = A'B'C + A'CD + BC'D + AB'D
 */
module prime_detector_4bit (
    input  wire A,
    input  wire B,
    input  wire C,
    input  wire D,
    output wire Y
);
    assign Y = (~A & ~B & C) | (~A & C & D) | (B & ~C & D) | (A & ~B & D);
endmodule
