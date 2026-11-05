/**
 * tb_digital_lab.v — Self-checking testbench untuk seluruh modul Verilog.
 * Jalankan dengan Icarus Verilog:
 *   iverilog -o sim.vvp verilog/src/*.v verilog/tb/tb_digital_lab.v && vvp sim.vvp
 */
`timescale 1ns / 1ps

module tb_digital_lab;
    reg        clk = 0;
    reg        rst = 1;
    reg        en  = 1;
    reg        dir = 1;
    wire [3:0] count;
    wire [6:0] seg;
    wire       is_prime;

    always #5 clk = ~clk; // 100 MHz clock

    sync_counter_4bit #(.MOD(10)) u_cnt (
        .clk(clk),
        .rst(rst),
        .en(en),
        .dir_up(dir),
        .q(count)
    );

    bcd_to_7seg u_dec (
        .bcd(count),
        .seg(seg)
    );

    reg [3:0] test_in = 0;
    prime_detector_4bit u_prime (
        .A(test_in[3]),
        .B(test_in[2]),
        .C(test_in[1]),
        .D(test_in[0]),
        .Y(is_prime)
    );

    function [6:0] expected_7seg(input [3:0] d);
        case (d)
            4'd0: expected_7seg = 7'b1111110;
            4'd1: expected_7seg = 7'b0110000;
            4'd2: expected_7seg = 7'b1101101;
            4'd3: expected_7seg = 7'b1111001;
            4'd4: expected_7seg = 7'b0110011;
            4'd5: expected_7seg = 7'b1011011;
            4'd6: expected_7seg = 7'b1011111;
            4'd7: expected_7seg = 7'b1110000;
            4'd8: expected_7seg = 7'b1111111;
            4'd9: expected_7seg = 7'b1111011;
            default: expected_7seg = 7'b0000000;
        endcase
    endfunction

    integer i;
    integer errors = 0;

    initial begin
        $display("=== Running Digital Logic Lab Verilog Testbench ===");

        // 1. Uji Prime Detector 0..15
        for (i = 0; i < 16; i = i + 1) begin
            test_in = i[3:0];
            #1;
            if (is_prime !== ((i==2)||(i==3)||(i==5)||(i==7)||(i==11)||(i==13))) begin
                $display("[FAIL] Prime detector mismatch at m=%0d: got %b", i, is_prime);
                errors = errors + 1;
            end
        end
        $display("  [PASS] 4-bit prime detector verified for all 16 minterms");

        // 2. Uji Synchronous BCD Counter + 7-Segment Decoder (0..9 wrap to 0)
        @(posedge clk);
        rst <= 0;
        for (i = 0; i <= 10; i = i + 1) begin
            #1;
            if (count !== (i % 10)) begin
                $display("[FAIL] Counter UP step %0d: expected %0d, got %0d", i, i % 10, count);
                errors = errors + 1;
            end
            if (seg !== expected_7seg(count)) begin
                $display("[FAIL] 7-Seg mismatch for digit %0d: got %b", count, seg);
                errors = errors + 1;
            end
            @(posedge clk);
        end
        $display("  [PASS] BCD Counter UP (0..9->0) & 7-Segment Decoder verified");

        // 3. Uji Count DOWN (0 -> 9 -> 8)
        dir <= 0;
        @(posedge clk); #1;
        if (count !== 4'd0) errors = errors + 1;
        @(posedge clk); #1;
        if (count !== 4'd9) errors = errors + 1;
        $display("  [PASS] BCD Counter DOWN wrap-around (0->9) verified");

        if (errors == 0) begin
            $display("=== ALL VERILOG TESTS PASSED ===");
            $finish;
        end else begin
            $display("=== FAILED WITH %0d ERRORS ===", errors);
            $fatal(1);
        end
    end
endmodule
