<?php

use Slim\Factory\AppFactory;
use Slim\Views\Twig;
use Slim\Views\TwigMiddleware;

use Symfony\Component\Translation\Translator;
use Symfony\Component\Translation\Loader\ArrayLoader;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

use Twig\Environment;
use Twig\TwigFunction;
use Twig\Loader\FilesystemLoader;

require __DIR__ . '/../vendor/autoload.php';

// Start session for language preference
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

//─────Load Templates─────
$loader = new FilesystemLoader(__DIR__ . '/../templates');
$twig   = new Environment($loader, [
    'cache'       => false,
    'auto_reload' => true,
]);

$twig = Twig::create(__DIR__ . '/../templates', [
    'cache' => false, // Mettre un chemin (ex: '/tmp/cache') en production
]);

//─────Load Translator─────

$translator = new Translator('en');

$translator->addLoader('array', new ArrayLoader());

$translator->addResource('array', require __DIR__ . '/../translations/message.en.php', 'en');
$translator->addResource('array', require __DIR__ . '/../translations/message.fr.php', 'fr');

$twig->getEnvironment()->addFunction(new TwigFunction('trans', function (string $key, array $params = []) use ($translator) {
    $locale = $_SESSION['lang'] ?? 'en';
    return $translator->trans($key, $params, null, $locale);
}));

// ─── APPLICATION ───────────────────────────────────────────────────────────

$basePath = '/UBarbershop';

$app = AppFactory::create();

$app->setBasePath('/UBarbershop/public');

// Ajouter base_path à tous les templates Twig
$app->addRoutingMiddleware();


$app->add(function (Request $request, RequestHandler $handler) {
    $twig = Twig::fromRequest($request);
    $twig->getEnvironment()->addGlobal('base_path', '/UBarbershop/public');
    $twig->getEnvironment()->addGlobal('app_lang', $_SESSION['lang'] ?? 'en');
    return $handler->handle($request);
});

$app->add(TwigMiddleware::create($app, $twig));
$app->addErrorMiddleware(true, true, true);

// ─── HTML ROUTES ───────────────────────────────────────────────────────────

$app->get('/', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'index.html.twig', [
        'base_path' => '/UBarbershop/public'
    ]); 
    });
    

$app->get('/lang/{locale}', function (Request $request, Response $response, array $args) use ($basePath) {
    $allowed = ['en', 'fr'];

    if (in_array($args['locale'], $allowed)) {
        $_SESSION['lang'] = $args['locale'];
    }

    // Get the referrer URL to redirect back to the same page
    $referrer = $request->getHeaderLine('Referer');

    // If no referrer or referrer is from a different domain, redirect to home
    if (empty($referrer) || strpos($referrer, $request->getUri()->getHost()) === false) {
        return $response->withHeader('Location', $basePath . '/public')->withStatus(302);
    }

    // Redirect back to the referring page
    return $response->withHeader('Location', $referrer)->withStatus(302);
});

$app->get('/about', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'about.html.twig', [
        'base_path' => '/UBarbershop/public'
    ]); 
});

$app->get('/contact', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

     return $view->render($response, 'contact.html.twig');
});

$app->get('/login', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'login.html.twig');
});

$app->get('/appointment', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'appointment.html.twig');
});

$app->get('/calendar', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'callendar.html.twig');
});

$app->get('/register', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'register.html.twig');
});

$app->get('/admin', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'admin.html.twig');
});

$app->get('/profile', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'profile.html.twig');
});

$app->get('/services', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'services.html.twig');
});

$app->get('/unavailable', function (Request $request, Response $response) {
    $view = Twig::fromRequest($request);

    return $view->render($response, 'unavailable.html.twig');
});

$app->run();
