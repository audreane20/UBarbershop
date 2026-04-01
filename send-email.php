<?php
header("Content-Type: application/json");

// Load config
$configPath = __DIR__ . "/config.local.php";

if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(["error" => "Missing config.local.php"]);
    exit;
}

require_once $configPath;

// Validate API key
if (!defined("BREVO_API_KEY") || trim(BREVO_API_KEY) === "") {
    http_response_code(500);
    echo json_encode(["error" => "Brevo API key not configured"]);
    exit;
}

// Parse request
$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid request"]);
    exit;
}

$action = $data["action"] ?? "send";

// =====================
// DELETE EMAIL (optional)
// =====================
if ($action === "delete") {
    $messageId = $data["messageId"] ?? "";

    if ($messageId === "") {
        http_response_code(400);
        echo json_encode(["error" => "Missing messageId"]);
        exit;
    }

    $ch = curl_init("https://api.brevo.com/v3/smtp/email/" . rawurlencode($messageId));

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "accept: application/json",
        "api-key: " . BREVO_API_KEY
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($response === false) {
        http_response_code(500);
        echo json_encode([
            "error" => "cURL delete request failed",
            "details" => curl_error($ch)
        ]);
        curl_close($ch);
        exit;
    }

    curl_close($ch);

    http_response_code($httpCode ?: 200);
    echo $response ?: json_encode(["ok" => true]);
    exit;
}

// =====================
// SEND EMAIL
// =====================
$payload = $data["payload"] ?? null;

if (!$payload || !is_array($payload)) {
    http_response_code(400);
    echo json_encode(["error" => "Missing payload"]);
    exit;
}

$ch = curl_init("https://api.brevo.com/v3/smtp/email");

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "accept: application/json",
    "api-key: " . BREVO_API_KEY,
    "content-type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($response === false) {
    http_response_code(500);
    echo json_encode([
        "error" => "cURL send request failed",
        "details" => curl_error($ch)
    ]);
    curl_close($ch);
    exit;
}

curl_close($ch);

// Return response
http_response_code($httpCode ?: 200);
echo $response ?: json_encode(["ok" => true]);