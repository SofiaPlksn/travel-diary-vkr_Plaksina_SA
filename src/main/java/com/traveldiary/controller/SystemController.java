package com.traveldiary.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.InetAddress;
import java.util.Map;

@RestController
@RequestMapping("/api/system")
public class SystemController {

    @GetMapping("/ip")
    public ResponseEntity<Map<String, String>> getLocalIp() {
        String ip;
        try (java.net.DatagramSocket socket = new java.net.DatagramSocket()) {
            socket.connect(InetAddress.getByName("8.8.8.8"), 10002);
            ip = socket.getLocalAddress().getHostAddress();
        } catch (Exception e) {
            try {
                ip = InetAddress.getLocalHost().getHostAddress();
            } catch (Exception ex) {
                ip = "localhost";
            }
        }
        return ResponseEntity.ok(Map.of("ip", ip));
    }
}
