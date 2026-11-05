/**
 * sync_counter_4bit.v — 4-Bit Synchronous Up/Down Counter dengan parameter MOD.
 * Default MOD = 10 (BCD Decade Counter 0..9).
 */
module sync_counter_4bit #(
    parameter integer MOD = 10
) (
    input  wire       clk,
    input  wire       rst,     // Synchronous active-high reset
    input  wire       en,      // Count enable
    input  wire       dir_up,  // 1 = count up, 0 = count down
    output reg  [3:0] q
);
    initial q = 4'd0;

    always @(posedge clk) begin
        if (rst) begin
            q <= 4'd0;
        end else if (en) begin
            if (dir_up)
                q <= (q == MOD - 1) ? 4'd0 : (q + 4'd1);
            else
                q <= (q == 4'd0) ? (MOD - 1) : (q - 4'd1);
        end
    end
endmodule
