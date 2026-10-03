-- MySQL dump 10.13  Distrib 8.4.3, for Win64 (x86_64)
--
-- Host: mysql-paseoclub-julioprudencio205-622d.i.aivencloud.com    Database: defaultdb
-- ------------------------------------------------------
-- Server version	8.4.8

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `AuditLog`
--

DROP TABLE IF EXISTS `AuditLog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `AuditLog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `action` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityType` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityId` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `AuditLog_userId_idx` (`userId`),
  CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `AuditLog`
--

LOCK TABLES `AuditLog` WRITE;
/*!40000 ALTER TABLE `AuditLog` DISABLE KEYS */;
INSERT INTO `AuditLog` VALUES (1,1,'EVENT_CHECK_IN','Event',1,'2026-08-01 21:30:00.000'),(2,1,'EVENT_CHECK_IN','Event',1,'2026-08-02 22:10:00.000'),(3,3,'TRANSACTION_UNDONE','Transaction',16,'2026-10-03 12:05:20.056'),(4,3,'CANCELLATION_REQUESTED','Transaction',9,'2026-10-03 12:05:45.356'),(5,3,'CANCELLATION_REQUESTED','Transaction',5,'2026-10-03 12:05:57.082'),(6,1,'CANCELLATION_APPROVED','Transaction',9,'2026-10-03 12:06:22.178'),(7,1,'CANCELLATION_REJECTED','Transaction',5,'2026-10-03 12:06:35.545'),(8,2,'PROFILE_UPDATED','User',2,'2026-10-03 12:08:00.005'),(9,3,'CATALOG_ITEM_UPDATED','CatalogItem',1,'2026-10-03 13:30:12.222'),(10,3,'CATALOG_ITEM_UPDATED','CatalogItem',1,'2026-10-03 13:30:14.932');
/*!40000 ALTER TABLE `AuditLog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Badge`
--

DROP TABLE IF EXISTS `Badge`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Badge` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `type` enum('TIER_REACHED','PURCHASE_COUNT','CATEGORY_PURCHASES','DISTINCT_BUSINESSES','MISSIONS_COMPLETED','SPECIAL_DATE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `goal` int DEFAULT NULL,
  `tierId` int DEFAULT NULL,
  `categoryId` int DEFAULT NULL,
  `date` date DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `createdById` int NOT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Badge_tierId_idx` (`tierId`),
  KEY `Badge_categoryId_idx` (`categoryId`),
  KEY `Badge_createdById_idx` (`createdById`),
  CONSTRAINT `Badge_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Badge_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Badge_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `Tier` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Badge`
--

LOCK TABLES `Badge` WRITE;
/*!40000 ALTER TABLE `Badge` DISABLE KEYS */;
INSERT INTO `Badge` VALUES (1,'Primera compra','Sumaste puntos por primera vez en el Paseo.','PURCHASE_COUNT',1,NULL,NULL,NULL,'ACTIVE',1,NULL),(2,'Cliente frecuente','Registraste 10 compras.','PURCHASE_COUNT',10,NULL,NULL,NULL,'ACTIVE',1,NULL),(3,'Fiel al Paseo','Registraste 25 compras.','PURCHASE_COUNT',25,NULL,NULL,NULL,'ACTIVE',1,NULL),(4,'Nivel Plata','Alcanzaste el nivel Plata.','TIER_REACHED',NULL,2,NULL,NULL,'ACTIVE',1,NULL),(5,'Nivel Oro','Alcanzaste el nivel Oro.','TIER_REACHED',NULL,3,NULL,NULL,'ACTIVE',1,NULL),(6,'Nivel Platinum','Alcanzaste el nivel más alto del programa.','TIER_REACHED',NULL,4,NULL,NULL,'ACTIVE',1,NULL),(7,'Buen diente','5 compras en restaurantes, cafeterías y comida rápida.','CATEGORY_PURCHASES',5,NULL,1,NULL,'ACTIVE',1,NULL),(8,'A la moda','3 compras en tiendas de moda.','CATEGORY_PURCHASES',3,NULL,4,NULL,'ACTIVE',1,NULL),(9,'Explorador','Compraste en 5 establecimientos distintos.','DISTINCT_BUSINESSES',5,NULL,NULL,NULL,'ACTIVE',1,NULL),(10,'Conocedor del Paseo','Compraste en 10 establecimientos distintos.','DISTINCT_BUSINESSES',10,NULL,NULL,NULL,'ACTIVE',1,NULL),(11,'Cazador de misiones','Completaste 3 misiones.','MISSIONS_COMPLETED',3,NULL,NULL,NULL,'ACTIVE',1,NULL),(12,'Urkupiña 2026','Visitaste el Paseo el día de la Feria del Descuento de Urkupiña.','SPECIAL_DATE',NULL,NULL,NULL,'2026-08-15','ACTIVE',1,NULL),(13,'Halloween 2026','Visitaste el Paseo en Halloween.','SPECIAL_DATE',NULL,NULL,NULL,'2026-10-31','ACTIVE',1,NULL),(14,'6.º aniversario del Paseo','Celebraste con nosotros el aniversario del Paseo Aranjuez.','SPECIAL_DATE',NULL,NULL,NULL,'2026-11-06','ACTIVE',1,NULL),(15,'Navidad 2026','Visitaste el Paseo en Navidad.','SPECIAL_DATE',NULL,NULL,NULL,'2026-12-25','ACTIVE',1,NULL);
/*!40000 ALTER TABLE `Badge` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Business`
--

DROP TABLE IF EXISTS `Business`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Business` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `logoUrl` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `floor` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sector` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `localNumber` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Business`
--

LOCK TABLES `Business` WRITE;
/*!40000 ALTER TABLE `Business` DISABLE KEYS */;
INSERT INTO `Business` VALUES (1,'Mocca Café y Gelato','Café de especialidad, gelato artesanal y repostería.',NULL,NULL,'3','Paseo de Comidas','305','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(2,'Almacén Pizza','Pizzas artesanales al estilo argentino.',NULL,NULL,'3','Paseo de Comidas','310','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(3,'Gap','Ropa casual para mujer, hombre y niños.',NULL,NULL,'PB','Ingreso Av. América','102','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(4,'Impulse','Zapatillas Nike, Adidas, Puma, Converse, New Balance y más.',NULL,NULL,'1','Ala norte','118','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(5,'Joyería Carrasco','Joyas en oro y plata, relojes y regalos.',NULL,NULL,'1','Ala sur','126','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(6,'Farmacorp','Farmacia, cuidado personal, higiene y comestibles.',NULL,NULL,'PB','Ingreso Pantaleón Dalence','108','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(7,'Cinnabon','Rollos de canela recién horneados y bebidas.',NULL,NULL,'PB','Plaza central','115','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(8,'Óptica Pauker','Lentes de receta, lentes de sol y examen visual.',NULL,NULL,'2','Ala norte','204','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(9,'Subway','Sándwiches y ensaladas armados a tu gusto.',NULL,NULL,'3','Paseo de Comidas','302','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(10,'Sushi Town','Rolls, combos de sushi y comida japonesa.',NULL,NULL,'3','Paseo de Comidas','312','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(11,'Tunari Gourmet','Cocina cochabambina de autor con vista al Tunari.',NULL,NULL,'4','Terraza El 4to','401','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(12,'Lili Pink','Ropa interior, pijamas y cosméticos.',NULL,NULL,'1','Ala sur','131','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(13,'Totto','Mochilas, maletas y accesorios de viaje.',NULL,NULL,'2','Ala sur','212','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(14,'Aldo','Calzado, carteras y accesorios de moda.',NULL,NULL,'1','Ala norte','112','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL);
/*!40000 ALTER TABLE `Business` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `BusinessCategory`
--

DROP TABLE IF EXISTS `BusinessCategory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `BusinessCategory` (
  `businessId` int NOT NULL,
  `categoryId` int NOT NULL,
  PRIMARY KEY (`businessId`,`categoryId`),
  KEY `BusinessCategory_categoryId_idx` (`categoryId`),
  CONSTRAINT `BusinessCategory_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `BusinessCategory`
--

LOCK TABLES `BusinessCategory` WRITE;
/*!40000 ALTER TABLE `BusinessCategory` DISABLE KEYS */;
INSERT INTO `BusinessCategory` VALUES (1,2),(7,2),(2,3),(3,5),(12,5),(4,6),(14,6),(5,7),(12,7),(13,7),(14,7),(6,8),(8,8),(9,9),(10,9),(11,10),(8,11);
/*!40000 ALTER TABLE `BusinessCategory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `BusinessDiscovery`
--

DROP TABLE IF EXISTS `BusinessDiscovery`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `BusinessDiscovery` (
  `userId` int NOT NULL,
  `businessId` int NOT NULL,
  `discoveredAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`userId`,`businessId`),
  KEY `BusinessDiscovery_businessId_idx` (`businessId`),
  CONSTRAINT `BusinessDiscovery_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessDiscovery_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `BusinessDiscovery`
--

LOCK TABLES `BusinessDiscovery` WRITE;
/*!40000 ALTER TABLE `BusinessDiscovery` DISABLE KEYS */;
INSERT INTO `BusinessDiscovery` VALUES (2,1,'2026-08-31 19:00:00.000'),(2,2,'2026-09-07 19:00:00.000'),(2,3,'2026-09-02 19:00:00.000'),(2,4,'2026-09-16 19:00:00.000'),(2,6,'2026-09-29 19:00:00.000'),(2,7,'2026-09-21 19:00:00.000'),(2,11,'2026-09-20 00:00:00.000'),(2,12,'2026-08-15 20:00:00.000'),(5,3,'2026-09-25 19:00:00.000'),(6,2,'2026-09-24 19:00:00.000'),(6,9,'2026-10-01 19:00:00.000');
/*!40000 ALTER TABLE `BusinessDiscovery` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `BusinessMember`
--

DROP TABLE IF EXISTS `BusinessMember`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `BusinessMember` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `businessId` int NOT NULL,
  `role` enum('STAFF','MANAGER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (`id`),
  UNIQUE KEY `BusinessMember_userId_key` (`userId`),
  KEY `BusinessMember_businessId_idx` (`businessId`),
  CONSTRAINT `BusinessMember_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `BusinessMember`
--

LOCK TABLES `BusinessMember` WRITE;
/*!40000 ALTER TABLE `BusinessMember` DISABLE KEYS */;
INSERT INTO `BusinessMember` VALUES (1,3,1,'MANAGER','ACTIVE'),(2,4,3,'MANAGER','ACTIVE'),(3,7,6,'STAFF','ACTIVE'),(4,8,2,'MANAGER','ACTIVE'),(5,9,4,'MANAGER','ACTIVE'),(6,10,5,'MANAGER','ACTIVE'),(7,11,6,'MANAGER','ACTIVE'),(8,12,7,'MANAGER','ACTIVE'),(9,13,8,'MANAGER','ACTIVE'),(10,14,9,'MANAGER','ACTIVE'),(11,15,10,'MANAGER','ACTIVE'),(12,16,11,'MANAGER','ACTIVE'),(13,17,12,'MANAGER','ACTIVE'),(14,18,13,'MANAGER','ACTIVE'),(15,19,14,'MANAGER','ACTIVE');
/*!40000 ALTER TABLE `BusinessMember` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `BusinessSchedule`
--

DROP TABLE IF EXISTS `BusinessSchedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `BusinessSchedule` (
  `id` int NOT NULL AUTO_INCREMENT,
  `businessId` int NOT NULL,
  `dayOfWeek` enum('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `openTime` time DEFAULT NULL,
  `closeTime` time DEFAULT NULL,
  `isClosed` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `BusinessSchedule_businessId_dayOfWeek_key` (`businessId`,`dayOfWeek`),
  CONSTRAINT `BusinessSchedule_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `BusinessSchedule`
--

LOCK TABLES `BusinessSchedule` WRITE;
/*!40000 ALTER TABLE `BusinessSchedule` DISABLE KEYS */;
INSERT INTO `BusinessSchedule` VALUES (1,1,'MONDAY','10:00:00','23:00:00',0),(2,1,'TUESDAY','10:00:00','23:00:00',0),(3,1,'WEDNESDAY','10:00:00','23:00:00',0),(4,1,'THURSDAY','10:00:00','23:00:00',0),(5,1,'FRIDAY','10:00:00','23:00:00',0),(6,1,'SATURDAY','10:00:00','23:00:00',0),(7,1,'SUNDAY','11:00:00','21:00:00',0),(8,2,'MONDAY','10:00:00','23:00:00',0),(9,2,'TUESDAY','10:00:00','23:00:00',0),(10,2,'WEDNESDAY','10:00:00','23:00:00',0),(11,2,'THURSDAY','10:00:00','23:00:00',0),(12,2,'FRIDAY','10:00:00','23:00:00',0),(13,2,'SATURDAY','10:00:00','23:00:00',0),(14,2,'SUNDAY','11:00:00','21:00:00',0),(15,3,'MONDAY','10:00:00','22:00:00',0),(16,3,'TUESDAY','10:00:00','22:00:00',0),(17,3,'WEDNESDAY','10:00:00','22:00:00',0),(18,3,'THURSDAY','10:00:00','22:00:00',0),(19,3,'FRIDAY','10:00:00','22:00:00',0),(20,3,'SATURDAY','10:00:00','22:00:00',0),(21,3,'SUNDAY','11:00:00','21:00:00',0),(22,4,'MONDAY','10:00:00','22:00:00',0),(23,4,'TUESDAY','10:00:00','22:00:00',0),(24,4,'WEDNESDAY','10:00:00','22:00:00',0),(25,4,'THURSDAY','10:00:00','22:00:00',0),(26,4,'FRIDAY','10:00:00','22:00:00',0),(27,4,'SATURDAY','10:00:00','22:00:00',0),(28,4,'SUNDAY','11:00:00','21:00:00',0),(29,5,'MONDAY','10:00:00','22:00:00',0),(30,5,'TUESDAY','10:00:00','22:00:00',0),(31,5,'WEDNESDAY','10:00:00','22:00:00',0),(32,5,'THURSDAY','10:00:00','22:00:00',0),(33,5,'FRIDAY','10:00:00','22:00:00',0),(34,5,'SATURDAY','10:00:00','22:00:00',0),(35,5,'SUNDAY','11:00:00','21:00:00',0),(36,6,'MONDAY','10:00:00','22:00:00',0),(37,6,'TUESDAY','10:00:00','22:00:00',0),(38,6,'WEDNESDAY','10:00:00','22:00:00',0),(39,6,'THURSDAY','10:00:00','22:00:00',0),(40,6,'FRIDAY','10:00:00','22:00:00',0),(41,6,'SATURDAY','10:00:00','22:00:00',0),(42,6,'SUNDAY','11:00:00','21:00:00',0),(43,7,'MONDAY','10:00:00','22:00:00',0),(44,7,'TUESDAY','10:00:00','22:00:00',0),(45,7,'WEDNESDAY','10:00:00','22:00:00',0),(46,7,'THURSDAY','10:00:00','22:00:00',0),(47,7,'FRIDAY','10:00:00','22:00:00',0),(48,7,'SATURDAY','10:00:00','22:00:00',0),(49,7,'SUNDAY','11:00:00','21:00:00',0),(50,8,'MONDAY','10:00:00','22:00:00',0),(51,8,'TUESDAY','10:00:00','22:00:00',0),(52,8,'WEDNESDAY','10:00:00','22:00:00',0),(53,8,'THURSDAY','10:00:00','22:00:00',0),(54,8,'FRIDAY','10:00:00','22:00:00',0),(55,8,'SATURDAY','10:00:00','22:00:00',0),(56,8,'SUNDAY','11:00:00','21:00:00',0),(57,9,'MONDAY','10:00:00','23:00:00',0),(58,9,'TUESDAY','10:00:00','23:00:00',0),(59,9,'WEDNESDAY','10:00:00','23:00:00',0),(60,9,'THURSDAY','10:00:00','23:00:00',0),(61,9,'FRIDAY','10:00:00','23:00:00',0),(62,9,'SATURDAY','10:00:00','23:00:00',0),(63,9,'SUNDAY','11:00:00','21:00:00',0),(64,10,'MONDAY','10:00:00','23:00:00',0),(65,10,'TUESDAY','10:00:00','23:00:00',0),(66,10,'WEDNESDAY','10:00:00','23:00:00',0),(67,10,'THURSDAY','10:00:00','23:00:00',0),(68,10,'FRIDAY','10:00:00','23:00:00',0),(69,10,'SATURDAY','10:00:00','23:00:00',0),(70,10,'SUNDAY','11:00:00','21:00:00',0),(71,11,'MONDAY','10:00:00','23:00:00',0),(72,11,'TUESDAY','10:00:00','23:00:00',0),(73,11,'WEDNESDAY','10:00:00','23:00:00',0),(74,11,'THURSDAY','10:00:00','23:00:00',0),(75,11,'FRIDAY','10:00:00','23:00:00',0),(76,11,'SATURDAY','10:00:00','23:00:00',0),(77,11,'SUNDAY','11:00:00','21:00:00',0),(78,12,'MONDAY','10:00:00','22:00:00',0),(79,12,'TUESDAY','10:00:00','22:00:00',0),(80,12,'WEDNESDAY','10:00:00','22:00:00',0),(81,12,'THURSDAY','10:00:00','22:00:00',0),(82,12,'FRIDAY','10:00:00','22:00:00',0),(83,12,'SATURDAY','10:00:00','22:00:00',0),(84,12,'SUNDAY','11:00:00','21:00:00',0),(85,13,'MONDAY','10:00:00','22:00:00',0),(86,13,'TUESDAY','10:00:00','22:00:00',0),(87,13,'WEDNESDAY','10:00:00','22:00:00',0),(88,13,'THURSDAY','10:00:00','22:00:00',0),(89,13,'FRIDAY','10:00:00','22:00:00',0),(90,13,'SATURDAY','10:00:00','22:00:00',0),(91,13,'SUNDAY','11:00:00','21:00:00',0),(92,14,'MONDAY','10:00:00','22:00:00',0),(93,14,'TUESDAY','10:00:00','22:00:00',0),(94,14,'WEDNESDAY','10:00:00','22:00:00',0),(95,14,'THURSDAY','10:00:00','22:00:00',0),(96,14,'FRIDAY','10:00:00','22:00:00',0),(97,14,'SATURDAY','10:00:00','22:00:00',0),(98,14,'SUNDAY','11:00:00','21:00:00',0);
/*!40000 ALTER TABLE `BusinessSchedule` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `CancellationRequest`
--

DROP TABLE IF EXISTS `CancellationRequest`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CancellationRequest` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transactionId` int NOT NULL,
  `requestedById` int NOT NULL,
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `reviewedById` int DEFAULT NULL,
  `reviewNote` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `CancellationRequest_transactionId_key` (`transactionId`),
  KEY `CancellationRequest_status_idx` (`status`),
  KEY `CancellationRequest_requestedById_idx` (`requestedById`),
  KEY `CancellationRequest_reviewedById_idx` (`reviewedById`),
  CONSTRAINT `CancellationRequest_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CancellationRequest_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CancellationRequest_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CancellationRequest`
--

LOCK TABLES `CancellationRequest` WRITE;
/*!40000 ALTER TABLE `CancellationRequest` DISABLE KEYS */;
INSERT INTO `CancellationRequest` VALUES (1,9,3,'La compra se registró dos veces.','APPROVED',1,'La compra se registró dos veces.','2026-10-03 12:05:45.356','2026-10-03 12:06:22.178'),(2,5,3,'El cliente devolvió los productos.','REJECTED',1,'La devolución fue hace más de 15 días; las devoluciones se manejan en caja con nota de crédito.','2026-10-03 12:05:57.082','2026-10-03 12:06:35.545');
/*!40000 ALTER TABLE `CancellationRequest` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `CatalogItem`
--

DROP TABLE IF EXISTS `CatalogItem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatalogItem` (
  `id` int NOT NULL AUTO_INCREMENT,
  `businessId` int NOT NULL,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `price` decimal(10,2) NOT NULL,
  `isAvailable` tinyint(1) NOT NULL DEFAULT '1',
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `CatalogItem_businessId_idx` (`businessId`),
  CONSTRAINT `CatalogItem_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CatalogItem`
--

LOCK TABLES `CatalogItem` WRITE;
/*!40000 ALTER TABLE `CatalogItem` DISABLE KEYS */;
INSERT INTO `CatalogItem` VALUES (1,1,'Capuchino','Doble shot de espresso con leche texturizada',22.00,1,NULL),(2,1,'Gelato 2 bolas',NULL,25.00,1,NULL),(3,1,'Torta de chocolate',NULL,28.00,1,NULL),(4,2,'Pizza personal',NULL,45.00,1,NULL),(5,2,'Pizza familiar napolitana','Tomate, mozzarella, ajo y orégano',110.00,1,NULL),(6,3,'Polera básica',NULL,189.00,1,NULL),(7,3,'Jeans clásicos',NULL,399.00,1,NULL),(8,4,'Zapatillas Nike Air',NULL,890.00,1,NULL),(9,4,'Zapatillas Adidas Running',NULL,790.00,1,NULL),(10,5,'Anillo de plata 950',NULL,450.00,1,NULL),(11,5,'Reloj de acero',NULL,1200.00,1,NULL),(12,6,'Protector solar FPS 50',NULL,120.00,1,NULL),(13,6,'Vitamina C x 30',NULL,65.00,1,NULL),(14,7,'Classic Roll','El clásico rollo de canela con frosting',32.00,1,NULL),(15,7,'MiniBon',NULL,20.00,1,NULL),(16,8,'Lentes de sol',NULL,650.00,1,NULL),(17,8,'Examen visual','Incluye medición de vista y asesoría',150.00,1,NULL),(18,9,'Sub de 30 cm',NULL,58.00,1,NULL),(19,9,'Sub de 15 cm',NULL,38.00,1,NULL),(20,10,'Combo 12 piezas',NULL,75.00,1,NULL),(21,11,'Pique macho','Clásico cochabambino para compartir',95.00,1,NULL),(22,11,'Silpancho',NULL,70.00,1,NULL),(23,12,'Pijama de algodón',NULL,180.00,1,NULL),(24,12,'Body splash',NULL,90.00,1,NULL),(25,13,'Mochila urbana',NULL,420.00,1,NULL),(26,14,'Botines de cuero',NULL,750.00,1,NULL);
/*!40000 ALTER TABLE `CatalogItem` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Category`
--

DROP TABLE IF EXISTS `Category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Category` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `parentId` int DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Category_parentId_idx` (`parentId`),
  CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Category`
--

LOCK TABLES `Category` WRITE;
/*!40000 ALTER TABLE `Category` DISABLE KEYS */;
INSERT INTO `Category` VALUES (1,'Gastronomía',NULL,'ACTIVE',NULL),(2,'Cafetería y postres',1,'ACTIVE',NULL),(3,'Pizzería',1,'ACTIVE',NULL),(4,'Moda',NULL,'ACTIVE',NULL),(5,'Ropa',4,'ACTIVE',NULL),(6,'Calzado',4,'ACTIVE',NULL),(7,'Joyería y accesorios',4,'ACTIVE',NULL),(8,'Salud y bienestar',NULL,'ACTIVE',NULL),(9,'Comida rápida',1,'ACTIVE',NULL),(10,'Restaurante gourmet',1,'ACTIVE',NULL),(11,'Servicios',NULL,'ACTIVE',NULL);
/*!40000 ALTER TABLE `Category` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Event`
--

DROP TABLE IF EXISTS `Event`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Event` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `location` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `startsAt` datetime(3) NOT NULL,
  `endsAt` datetime(3) NOT NULL,
  `pointsReward` int NOT NULL DEFAULT '0',
  `status` enum('DRAFT','ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `createdById` int NOT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Event_createdById_idx` (`createdById`),
  CONSTRAINT `Event_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Event`
--

LOCK TABLES `Event` WRITE;
/*!40000 ALTER TABLE `Event` DISABLE KEYS */;
INSERT INTO `Event` VALUES (1,'Festival Potterhead','Tres días de magia, disfraces y concursos para fans de Harry Potter.','Experience Store, planta baja','2026-07-31 14:00:00.000','2026-08-03 02:00:00.000',150,'ACTIVE',1,NULL),(2,'Semana del Café','Catas guiadas y baristas invitados en el Paseo de Comidas.','Paseo de Comidas, piso 3','2026-10-02 04:00:00.000','2026-10-07 03:00:00.000',100,'ACTIVE',1,NULL),(3,'Halloween en el Paseo','Desfile de disfraces, dulces en las tiendas y concurso familiar.','Experience Store y pasillos','2026-10-31 20:00:00.000','2026-11-01 02:00:00.000',200,'ACTIVE',1,NULL),(4,'Encendido del árbol navideño','Coro, chocolate caliente y la llegada de Papá Noel.','Plaza central, planta baja','2026-12-05 23:00:00.000','2026-12-06 02:00:00.000',200,'ACTIVE',1,NULL);
/*!40000 ALTER TABLE `Event` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `EventAttendance`
--

DROP TABLE IF EXISTS `EventAttendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `EventAttendance` (
  `eventId` int NOT NULL,
  `userId` int NOT NULL,
  `checkedInById` int NOT NULL,
  `checkedInAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`eventId`,`userId`),
  KEY `EventAttendance_userId_idx` (`userId`),
  KEY `EventAttendance_checkedInById_idx` (`checkedInById`),
  CONSTRAINT `EventAttendance_checkedInById_fkey` FOREIGN KEY (`checkedInById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `EventAttendance_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `EventAttendance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `EventAttendance`
--

LOCK TABLES `EventAttendance` WRITE;
/*!40000 ALTER TABLE `EventAttendance` DISABLE KEYS */;
INSERT INTO `EventAttendance` VALUES (1,2,1,'2026-08-01 21:30:00.000'),(1,6,1,'2026-08-02 22:10:00.000');
/*!40000 ALTER TABLE `EventAttendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `FraudAlert`
--

DROP TABLE IF EXISTS `FraudAlert`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `FraudAlert` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transactionId` int DEFAULT NULL,
  `redemptionId` int DEFAULT NULL,
  `type` enum('DUPLICATE_TRANSACTION','REUSED_REDEMPTION','HIGH_FREQUENCY','ABNORMAL_AMOUNT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `riskScore` int NOT NULL,
  `status` enum('OPEN','RESOLVED','DISMISSED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OPEN',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `FraudAlert_status_idx` (`status`),
  KEY `FraudAlert_transactionId_idx` (`transactionId`),
  KEY `FraudAlert_redemptionId_idx` (`redemptionId`),
  CONSTRAINT `FraudAlert_redemptionId_fkey` FOREIGN KEY (`redemptionId`) REFERENCES `Redemption` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `FraudAlert_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `FraudAlert`
--

LOCK TABLES `FraudAlert` WRITE;
/*!40000 ALTER TABLE `FraudAlert` DISABLE KEYS */;
INSERT INTO `FraudAlert` VALUES (1,15,NULL,'DUPLICATE_TRANSACTION',85,'OPEN','2026-09-25 19:03:00.000');
/*!40000 ALTER TABLE `FraudAlert` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Mission`
--

DROP TABLE IF EXISTS `Mission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Mission` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `type` enum('BUY_DISTINCT_BUSINESSES','BUY_CATEGORY','BUY_DISTINCT_CATEGORIES','TOTAL_PURCHASE_AMOUNT','TRANSACTION_COUNT','WEEKLY_PURCHASE','DISCOVER_BUSINESS') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `goal` int NOT NULL,
  `rewardPoints` int NOT NULL,
  `rewardStatus` int NOT NULL,
  `startsAt` datetime(3) NOT NULL,
  `endsAt` datetime(3) NOT NULL,
  `status` enum('DRAFT','ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `createdById` int NOT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Mission_createdById_idx` (`createdById`),
  CONSTRAINT `Mission_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Mission`
--

LOCK TABLES `Mission` WRITE;
/*!40000 ALTER TABLE `Mission` DISABLE KEYS */;
INSERT INTO `Mission` VALUES (1,'Ruta gastronómica','Compra en 2 locales del Paseo de Comidas o de El 4to.','BUY_DISTINCT_BUSINESSES',2,300,100,'2026-08-24 04:00:00.000','2026-11-03 03:00:00.000','ACTIVE',1,NULL),(2,'Explorador del Paseo','Compra por primera vez en 8 establecimientos.','DISCOVER_BUSINESS',8,500,200,'2026-08-24 04:00:00.000','2026-11-03 03:00:00.000','ACTIVE',1,NULL),(3,'Constancia','Compra en 4 semanas distintas.','WEEKLY_PURCHASE',4,400,200,'2026-08-24 04:00:00.000','2026-11-03 03:00:00.000','ACTIVE',1,NULL),(4,'Gran compra','Acumula Bs 3.000 en compras.','TOTAL_PURCHASE_AMOUNT',3000,600,250,'2026-08-24 04:00:00.000','2026-11-03 03:00:00.000','ACTIVE',1,NULL),(5,'Mix de estilos','Compra en 3 categorías distintas.','BUY_DISTINCT_CATEGORIES',3,350,150,'2026-08-24 04:00:00.000','2026-11-03 03:00:00.000','ACTIVE',1,NULL);
/*!40000 ALTER TABLE `Mission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `MissionBusiness`
--

DROP TABLE IF EXISTS `MissionBusiness`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `MissionBusiness` (
  `missionId` int NOT NULL,
  `businessId` int NOT NULL,
  PRIMARY KEY (`missionId`,`businessId`),
  KEY `MissionBusiness_businessId_idx` (`businessId`),
  CONSTRAINT `MissionBusiness_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MissionBusiness_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `MissionBusiness`
--

LOCK TABLES `MissionBusiness` WRITE;
/*!40000 ALTER TABLE `MissionBusiness` DISABLE KEYS */;
/*!40000 ALTER TABLE `MissionBusiness` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `MissionCategory`
--

DROP TABLE IF EXISTS `MissionCategory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `MissionCategory` (
  `missionId` int NOT NULL,
  `categoryId` int NOT NULL,
  PRIMARY KEY (`missionId`,`categoryId`),
  KEY `MissionCategory_categoryId_idx` (`categoryId`),
  CONSTRAINT `MissionCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MissionCategory_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `MissionCategory`
--

LOCK TABLES `MissionCategory` WRITE;
/*!40000 ALTER TABLE `MissionCategory` DISABLE KEYS */;
INSERT INTO `MissionCategory` VALUES (1,1);
/*!40000 ALTER TABLE `MissionCategory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `MissionProgress`
--

DROP TABLE IF EXISTS `MissionProgress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `MissionProgress` (
  `missionId` int NOT NULL,
  `userId` int NOT NULL,
  `progress` int NOT NULL DEFAULT '0',
  `completedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`missionId`,`userId`),
  KEY `MissionProgress_userId_idx` (`userId`),
  CONSTRAINT `MissionProgress_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MissionProgress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `MissionProgress`
--

LOCK TABLES `MissionProgress` WRITE;
/*!40000 ALTER TABLE `MissionProgress` DISABLE KEYS */;
INSERT INTO `MissionProgress` VALUES (1,2,2,'2026-09-07 19:00:00.000'),(1,6,2,'2026-10-01 19:00:00.000'),(2,2,7,NULL),(2,5,1,NULL),(2,6,2,NULL),(3,2,4,'2026-09-21 19:00:00.000'),(3,5,1,NULL),(3,6,2,NULL),(4,2,2216,NULL),(4,5,588,NULL),(4,6,206,NULL),(5,2,3,'2026-09-07 19:00:00.000'),(5,5,1,NULL),(5,6,2,NULL);
/*!40000 ALTER TABLE `MissionProgress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Notification`
--

DROP TABLE IF EXISTS `Notification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Notification` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `title` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `readAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Notification_userId_idx` (`userId`),
  CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Notification`
--

LOCK TABLES `Notification` WRITE;
/*!40000 ALTER TABLE `Notification` DISABLE KEYS */;
INSERT INTO `Notification` VALUES (1,2,'Ajuste de puntos en Mocca Café y Gelato','Se te descontaron 180 puntos porque se anuló tu compra del 28 sept 2026 en Mocca Café y Gelato (Bs 72,00). Motivo: La compra se registró dos veces.','2026-10-03 12:06:22.178','2026-10-03 13:40:29.618');
/*!40000 ALTER TABLE `Notification` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PointMovement`
--

DROP TABLE IF EXISTS `PointMovement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PointMovement` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `transactionId` int DEFAULT NULL,
  `redemptionId` int DEFAULT NULL,
  `missionId` int DEFAULT NULL,
  `promotionId` int DEFAULT NULL,
  `type` enum('PURCHASE','MISSION','PROMOTION','EVENT','REDEMPTION','ADJUSTMENT','REVERSAL') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `eventId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `PointMovement_userId_idx` (`userId`),
  KEY `PointMovement_createdAt_idx` (`createdAt`),
  KEY `PointMovement_transactionId_idx` (`transactionId`),
  KEY `PointMovement_redemptionId_idx` (`redemptionId`),
  KEY `PointMovement_missionId_idx` (`missionId`),
  KEY `PointMovement_promotionId_idx` (`promotionId`),
  KEY `PointMovement_eventId_idx` (`eventId`),
  CONSTRAINT `PointMovement_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PointMovement_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PointMovement_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `Promotion` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PointMovement_redemptionId_fkey` FOREIGN KEY (`redemptionId`) REFERENCES `Redemption` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PointMovement_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PointMovement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PointMovement`
--

LOCK TABLES `PointMovement` WRITE;
/*!40000 ALTER TABLE `PointMovement` DISABLE KEYS */;
INSERT INTO `PointMovement` VALUES (1,2,1,NULL,NULL,NULL,'PURCHASE',270,'2026-08-15 20:00:00.000',NULL),(2,2,1,NULL,NULL,3,'PROMOTION',135,'2026-08-15 20:00:00.000',NULL),(3,2,2,NULL,NULL,NULL,'PURCHASE',50,'2026-08-31 19:00:00.000',NULL),(4,2,3,NULL,NULL,NULL,'PURCHASE',399,'2026-09-02 19:00:00.000',NULL),(5,2,4,NULL,NULL,NULL,'PURCHASE',155,'2026-09-07 19:00:00.000',NULL),(6,2,NULL,NULL,1,NULL,'MISSION',300,'2026-09-07 19:00:00.000',NULL),(7,2,NULL,NULL,5,NULL,'MISSION',350,'2026-09-07 19:00:00.000',NULL),(8,2,5,NULL,NULL,NULL,'PURCHASE',44,'2026-09-14 19:00:00.000',NULL),(9,2,6,NULL,NULL,NULL,'PURCHASE',790,'2026-09-16 19:00:00.000',NULL),(10,2,7,NULL,NULL,NULL,'PURCHASE',206,'2026-09-20 00:00:00.000',NULL),(11,2,8,NULL,NULL,NULL,'PURCHASE',80,'2026-09-21 19:00:00.000',NULL),(12,2,NULL,NULL,3,NULL,'MISSION',400,'2026-09-21 19:00:00.000',NULL),(13,2,9,NULL,NULL,NULL,'PURCHASE',90,'2026-09-28 19:00:00.000',NULL),(14,2,9,NULL,NULL,1,'PROMOTION',90,'2026-09-28 19:00:00.000',NULL),(15,2,10,NULL,NULL,NULL,'PURCHASE',312,'2026-09-29 19:00:00.000',NULL),(16,2,10,NULL,NULL,2,'PROMOTION',100,'2026-09-29 19:00:00.000',NULL),(17,2,11,NULL,NULL,NULL,'PURCHASE',193,'2026-10-02 19:00:00.000',NULL),(18,6,12,NULL,NULL,NULL,'PURCHASE',110,'2026-09-24 19:00:00.000',NULL),(19,6,13,NULL,NULL,NULL,'PURCHASE',96,'2026-10-01 19:00:00.000',NULL),(20,6,NULL,NULL,1,NULL,'MISSION',300,'2026-10-01 19:00:00.000',NULL),(21,5,14,NULL,NULL,NULL,'PURCHASE',588,'2026-09-25 19:00:00.000',NULL),(22,2,NULL,1,NULL,NULL,'REDEMPTION',-500,'2026-09-23 19:00:00.000',NULL),(23,2,NULL,2,NULL,NULL,'REDEMPTION',-300,'2026-10-03 11:54:02.838',NULL),(24,2,NULL,NULL,NULL,NULL,'EVENT',150,'2026-08-01 21:30:00.000',1),(25,6,NULL,NULL,NULL,NULL,'EVENT',150,'2026-08-02 22:10:00.000',1),(26,2,16,NULL,NULL,NULL,'PURCHASE',90,'2026-10-03 12:04:49.940',NULL),(27,2,16,NULL,NULL,1,'PROMOTION',90,'2026-10-03 12:04:49.940',NULL),(28,2,16,NULL,NULL,NULL,'REVERSAL',-180,'2026-10-03 12:05:20.056',NULL),(29,2,9,NULL,NULL,NULL,'REVERSAL',-180,'2026-10-03 12:06:22.178',NULL),(30,2,NULL,3,NULL,NULL,'REDEMPTION',-500,'2026-10-03 12:07:14.672',NULL),(31,2,NULL,3,NULL,NULL,'REVERSAL',500,'2026-10-03 12:07:23.249',NULL),(32,2,NULL,4,NULL,NULL,'REDEMPTION',-300,'2026-10-03 14:46:56.639',NULL),(33,2,NULL,5,NULL,NULL,'REDEMPTION',-300,'2026-10-03 14:47:56.031',NULL),(34,2,NULL,4,NULL,NULL,'REVERSAL',300,'2026-10-03 15:02:04.497',NULL),(35,2,NULL,5,NULL,NULL,'REVERSAL',300,'2026-10-03 15:03:04.532',NULL);
/*!40000 ALTER TABLE `PointMovement` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Promotion`
--

DROP TABLE IF EXISTS `Promotion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Promotion` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('POINTS_MULTIPLIER','FIXED_POINTS') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `startsAt` datetime(3) NOT NULL,
  `endsAt` datetime(3) NOT NULL,
  `status` enum('DRAFT','ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `createdById` int NOT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Promotion_createdById_idx` (`createdById`),
  CONSTRAINT `Promotion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Promotion`
--

LOCK TABLES `Promotion` WRITE;
/*!40000 ALTER TABLE `Promotion` DISABLE KEYS */;
INSERT INTO `Promotion` VALUES (1,'Doble puntos en cafeterías','POINTS_MULTIPLIER',2.00,'2026-09-23 04:00:00.000','2026-10-24 03:00:00.000','ACTIVE',1,NULL),(2,'+100 puntos en Farmacorp','FIXED_POINTS',100.00,'2026-09-23 04:00:00.000','2026-10-24 03:00:00.000','ACTIVE',1,NULL),(3,'Feria del Descuento de Urkupiña: puntos ×1,5 en moda','POINTS_MULTIPLIER',1.50,'2026-08-15 14:00:00.000','2026-08-16 02:00:00.000','ACTIVE',1,NULL);
/*!40000 ALTER TABLE `Promotion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PromotionBusiness`
--

DROP TABLE IF EXISTS `PromotionBusiness`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PromotionBusiness` (
  `promotionId` int NOT NULL,
  `businessId` int NOT NULL,
  PRIMARY KEY (`promotionId`,`businessId`),
  KEY `PromotionBusiness_businessId_idx` (`businessId`),
  CONSTRAINT `PromotionBusiness_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PromotionBusiness_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `Promotion` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PromotionBusiness`
--

LOCK TABLES `PromotionBusiness` WRITE;
/*!40000 ALTER TABLE `PromotionBusiness` DISABLE KEYS */;
INSERT INTO `PromotionBusiness` VALUES (2,6);
/*!40000 ALTER TABLE `PromotionBusiness` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PromotionCategory`
--

DROP TABLE IF EXISTS `PromotionCategory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PromotionCategory` (
  `promotionId` int NOT NULL,
  `categoryId` int NOT NULL,
  PRIMARY KEY (`promotionId`,`categoryId`),
  KEY `PromotionCategory_categoryId_idx` (`categoryId`),
  CONSTRAINT `PromotionCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PromotionCategory_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `Promotion` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PromotionCategory`
--

LOCK TABLES `PromotionCategory` WRITE;
/*!40000 ALTER TABLE `PromotionCategory` DISABLE KEYS */;
INSERT INTO `PromotionCategory` VALUES (1,2),(3,4);
/*!40000 ALTER TABLE `PromotionCategory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Redemption`
--

DROP TABLE IF EXISTS `Redemption`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Redemption` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `rewardId` int NOT NULL,
  `businessId` int DEFAULT NULL,
  `validatedById` int DEFAULT NULL,
  `pointsSpent` int NOT NULL,
  `verificationToken` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','REDEEMED','EXPIRED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `redeemedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Redemption_verificationToken_key` (`verificationToken`),
  KEY `Redemption_userId_idx` (`userId`),
  KEY `Redemption_rewardId_idx` (`rewardId`),
  KEY `Redemption_businessId_idx` (`businessId`),
  KEY `Redemption_validatedById_idx` (`validatedById`),
  CONSTRAINT `Redemption_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Redemption_rewardId_fkey` FOREIGN KEY (`rewardId`) REFERENCES `Reward` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Redemption_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Redemption_validatedById_fkey` FOREIGN KEY (`validatedById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Redemption`
--

LOCK TABLES `Redemption` WRITE;
/*!40000 ALTER TABLE `Redemption` DISABLE KEYS */;
INSERT INTO `Redemption` VALUES (1,2,2,7,12,500,'Z6G2L-AVT2K','REDEEMED','2026-09-23 19:00:00.000','2026-09-23 19:04:00.000'),(2,2,1,1,3,300,'GNXP9-Z8ETS','REDEEMED','2026-10-03 11:54:02.838','2026-10-03 12:06:59.776'),(3,2,2,NULL,NULL,500,'UH5BL-ZG2Y7','CANCELLED','2026-10-03 12:07:14.672',NULL),(4,2,1,NULL,NULL,300,'EARCA-BJH7K','EXPIRED','2026-10-03 14:46:56.639',NULL),(5,2,1,NULL,NULL,300,'8TKJJ-P7BEQ','EXPIRED','2026-10-03 14:47:56.031',NULL);
/*!40000 ALTER TABLE `Redemption` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Reward`
--

DROP TABLE IF EXISTS `Reward`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Reward` (
  `id` int NOT NULL AUTO_INCREMENT,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `pointsCost` int NOT NULL,
  `minimumTierId` int DEFAULT NULL,
  `stock` int DEFAULT NULL,
  `startsAt` datetime(3) DEFAULT NULL,
  `endsAt` datetime(3) DEFAULT NULL,
  `status` enum('DRAFT','ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `createdById` int NOT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  `businessId` int NOT NULL,
  `type` enum('PERCENT_DISCOUNT','AMOUNT_DISCOUNT','FREE_PRODUCT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `discountPercent` int DEFAULT NULL,
  `discountAmount` decimal(10,2) DEFAULT NULL,
  `catalogItemId` int DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `minimumPurchase` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Reward_minimumTierId_idx` (`minimumTierId`),
  KEY `Reward_createdById_idx` (`createdById`),
  KEY `Reward_businessId_idx` (`businessId`),
  KEY `Reward_catalogItemId_idx` (`catalogItemId`),
  CONSTRAINT `Reward_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Reward_catalogItemId_fkey` FOREIGN KEY (`catalogItemId`) REFERENCES `CatalogItem` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Reward_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Reward_minimumTierId_fkey` FOREIGN KEY (`minimumTierId`) REFERENCES `Tier` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Reward`
--

LOCK TABLES `Reward` WRITE;
/*!40000 ALTER TABLE `Reward` DISABLE KEYS */;
INSERT INTO `Reward` VALUES (1,'Válido en cualquier consumo del local.',300,NULL,NULL,NULL,NULL,'ACTIVE',3,NULL,1,'AMOUNT_DISCOUNT',NULL,20.00,NULL,1,NULL),(2,NULL,500,NULL,NULL,NULL,NULL,'ACTIVE',12,NULL,7,'FREE_PRODUCT',NULL,NULL,14,1,NULL),(3,NULL,700,NULL,NULL,NULL,NULL,'ACTIVE',8,NULL,2,'FREE_PRODUCT',NULL,NULL,4,1,NULL),(4,'No acumulable con otras ofertas de la tienda.',1000,2,NULL,NULL,NULL,'ACTIVE',4,NULL,3,'PERCENT_DISCOUNT',15,NULL,NULL,1,200.00),(5,NULL,1500,NULL,NULL,NULL,NULL,'ACTIVE',9,NULL,4,'AMOUNT_DISCOUNT',NULL,100.00,NULL,1,600.00),(6,'Para consumir en la terraza de El 4to.',3000,3,20,NULL,NULL,'ACTIVE',16,NULL,11,'FREE_PRODUCT',NULL,NULL,21,2,NULL),(7,NULL,700,NULL,NULL,NULL,NULL,'DRAFT',13,NULL,8,'FREE_PRODUCT',NULL,NULL,17,1,NULL);
/*!40000 ALTER TABLE `Reward` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StatusMovement`
--

DROP TABLE IF EXISTS `StatusMovement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StatusMovement` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `transactionId` int DEFAULT NULL,
  `missionId` int DEFAULT NULL,
  `type` enum('PURCHASE','MISSION','DISCOVERY','STREAK','ADJUSTMENT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `StatusMovement_userId_idx` (`userId`),
  KEY `StatusMovement_transactionId_idx` (`transactionId`),
  KEY `StatusMovement_missionId_idx` (`missionId`),
  CONSTRAINT `StatusMovement_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StatusMovement_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StatusMovement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StatusMovement`
--

LOCK TABLES `StatusMovement` WRITE;
/*!40000 ALTER TABLE `StatusMovement` DISABLE KEYS */;
INSERT INTO `StatusMovement` VALUES (1,2,1,NULL,'PURCHASE',270,'2026-08-15 20:00:00.000'),(2,2,1,NULL,'DISCOVERY',50,'2026-08-15 20:00:00.000'),(3,2,2,NULL,'PURCHASE',50,'2026-08-31 19:00:00.000'),(4,2,2,NULL,'DISCOVERY',50,'2026-08-31 19:00:00.000'),(5,2,3,NULL,'PURCHASE',399,'2026-09-02 19:00:00.000'),(6,2,3,NULL,'DISCOVERY',50,'2026-09-02 19:00:00.000'),(7,2,4,NULL,'PURCHASE',155,'2026-09-07 19:00:00.000'),(8,2,4,NULL,'DISCOVERY',50,'2026-09-07 19:00:00.000'),(9,2,4,NULL,'STREAK',20,'2026-09-07 19:00:00.000'),(10,2,NULL,1,'MISSION',100,'2026-09-07 19:00:00.000'),(11,2,NULL,5,'MISSION',150,'2026-09-07 19:00:00.000'),(12,2,5,NULL,'PURCHASE',44,'2026-09-14 19:00:00.000'),(13,2,5,NULL,'STREAK',30,'2026-09-14 19:00:00.000'),(14,2,6,NULL,'PURCHASE',790,'2026-09-16 19:00:00.000'),(15,2,6,NULL,'DISCOVERY',50,'2026-09-16 19:00:00.000'),(16,2,7,NULL,'PURCHASE',165,'2026-09-20 00:00:00.000'),(17,2,7,NULL,'DISCOVERY',50,'2026-09-20 00:00:00.000'),(18,2,8,NULL,'PURCHASE',64,'2026-09-21 19:00:00.000'),(19,2,8,NULL,'DISCOVERY',50,'2026-09-21 19:00:00.000'),(20,2,8,NULL,'STREAK',40,'2026-09-21 19:00:00.000'),(21,2,NULL,3,'MISSION',200,'2026-09-21 19:00:00.000'),(22,2,9,NULL,'PURCHASE',72,'2026-09-28 19:00:00.000'),(23,2,9,NULL,'STREAK',50,'2026-09-28 19:00:00.000'),(24,2,10,NULL,'PURCHASE',250,'2026-09-29 19:00:00.000'),(25,2,10,NULL,'DISCOVERY',50,'2026-09-29 19:00:00.000'),(26,2,11,NULL,'PURCHASE',155,'2026-10-02 19:00:00.000'),(27,6,12,NULL,'PURCHASE',110,'2026-09-24 19:00:00.000'),(28,6,12,NULL,'DISCOVERY',50,'2026-09-24 19:00:00.000'),(29,6,13,NULL,'PURCHASE',96,'2026-10-01 19:00:00.000'),(30,6,13,NULL,'DISCOVERY',50,'2026-10-01 19:00:00.000'),(31,6,13,NULL,'STREAK',20,'2026-10-01 19:00:00.000'),(32,6,NULL,1,'MISSION',100,'2026-10-01 19:00:00.000'),(33,5,14,NULL,'PURCHASE',588,'2026-09-25 19:00:00.000'),(34,5,14,NULL,'DISCOVERY',50,'2026-09-25 19:00:00.000'),(35,2,16,NULL,'PURCHASE',72,'2026-10-03 12:04:49.940'),(36,2,16,NULL,'ADJUSTMENT',-72,'2026-10-03 12:05:20.056'),(37,2,9,NULL,'ADJUSTMENT',-122,'2026-10-03 12:06:22.178');
/*!40000 ALTER TABLE `StatusMovement` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SystemSetting`
--

DROP TABLE IF EXISTS `SystemSetting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SystemSetting` (
  `key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SystemSetting`
--

LOCK TABLES `SystemSetting` WRITE;
/*!40000 ALTER TABLE `SystemSetting` DISABLE KEYS */;
INSERT INTO `SystemSetting` VALUES ('ABNORMAL_AMOUNT_THRESHOLD','5000','2026-07-05 19:00:00.000'),('POINTS_BASE_RATE','1','2026-07-05 19:00:00.000'),('STATUS_BASE_RATE','1','2026-07-05 19:00:00.000');
/*!40000 ALTER TABLE `SystemSetting` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Tier`
--

DROP TABLE IF EXISTS `Tier`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Tier` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `minimumStatus` int NOT NULL,
  `pointsMultiplier` decimal(4,2) NOT NULL DEFAULT '1.00',
  `sortOrder` int NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `Tier_name_key` (`name`),
  UNIQUE KEY `Tier_minimumStatus_key` (`minimumStatus`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Tier`
--

LOCK TABLES `Tier` WRITE;
/*!40000 ALTER TABLE `Tier` DISABLE KEYS */;
INSERT INTO `Tier` VALUES (1,'Bronce',0,1.00,1,1),(2,'Plata',1500,1.25,2,1),(3,'Oro',5000,1.50,3,1),(4,'Platinum',12000,2.00,4,1);
/*!40000 ALTER TABLE `Tier` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Transaction`
--

DROP TABLE IF EXISTS `Transaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Transaction` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customerId` int NOT NULL,
  `businessId` int NOT NULL,
  `performedById` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` enum('COMPLETED','CANCELLED','FLAGGED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'COMPLETED',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Transaction_customerId_idx` (`customerId`),
  KEY `Transaction_businessId_idx` (`businessId`),
  KEY `Transaction_performedById_idx` (`performedById`),
  KEY `Transaction_createdAt_idx` (`createdAt`),
  CONSTRAINT `Transaction_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Transaction_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Transaction_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Transaction`
--

LOCK TABLES `Transaction` WRITE;
/*!40000 ALTER TABLE `Transaction` DISABLE KEYS */;
INSERT INTO `Transaction` VALUES (1,2,12,17,270.00,'COMPLETED','2026-08-15 20:00:00.000'),(2,2,1,3,50.00,'COMPLETED','2026-08-31 19:00:00.000'),(3,2,3,4,399.00,'COMPLETED','2026-09-02 19:00:00.000'),(4,2,2,8,155.00,'COMPLETED','2026-09-07 19:00:00.000'),(5,2,1,3,44.00,'COMPLETED','2026-09-14 19:00:00.000'),(6,2,4,9,790.00,'COMPLETED','2026-09-16 19:00:00.000'),(7,2,11,16,165.00,'COMPLETED','2026-09-20 00:00:00.000'),(8,2,7,12,64.00,'COMPLETED','2026-09-21 19:00:00.000'),(9,2,1,3,72.00,'CANCELLED','2026-09-28 19:00:00.000'),(10,2,6,7,250.00,'COMPLETED','2026-09-29 19:00:00.000'),(11,2,2,8,155.00,'COMPLETED','2026-10-02 19:00:00.000'),(12,6,2,8,110.00,'COMPLETED','2026-09-24 19:00:00.000'),(13,6,9,14,96.00,'COMPLETED','2026-10-01 19:00:00.000'),(14,5,3,4,588.00,'COMPLETED','2026-09-25 19:00:00.000'),(15,5,3,4,588.00,'FLAGGED','2026-09-25 19:03:00.000'),(16,2,1,3,72.00,'CANCELLED','2026-10-03 12:04:49.940');
/*!40000 ALTER TABLE `Transaction` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `TransactionItem`
--

DROP TABLE IF EXISTS `TransactionItem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `TransactionItem` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transactionId` int NOT NULL,
  `catalogItemId` int NOT NULL,
  `quantity` int NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `TransactionItem_transactionId_idx` (`transactionId`),
  KEY `TransactionItem_catalogItemId_idx` (`catalogItemId`),
  CONSTRAINT `TransactionItem_catalogItemId_fkey` FOREIGN KEY (`catalogItemId`) REFERENCES `CatalogItem` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `TransactionItem_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `TransactionItem`
--

LOCK TABLES `TransactionItem` WRITE;
/*!40000 ALTER TABLE `TransactionItem` DISABLE KEYS */;
INSERT INTO `TransactionItem` VALUES (1,1,23,1,180.00),(2,1,24,1,90.00),(3,2,1,1,22.00),(4,2,3,1,28.00),(5,3,7,1,399.00),(6,4,5,1,110.00),(7,4,4,1,45.00),(8,5,1,2,22.00),(9,6,9,1,790.00),(10,7,21,1,95.00),(11,7,22,1,70.00),(12,8,14,2,32.00),(13,9,1,2,22.00),(14,9,3,1,28.00),(15,10,12,1,120.00),(16,10,13,2,65.00),(17,11,5,1,110.00),(18,11,4,1,45.00),(19,12,5,1,110.00),(20,13,18,1,58.00),(21,13,19,1,38.00),(22,14,6,1,189.00),(23,14,7,1,399.00),(24,15,6,1,189.00),(25,15,7,1,399.00),(26,16,1,2,22.00),(27,16,3,1,28.00);
/*!40000 ALTER TABLE `TransactionItem` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `User`
--

DROP TABLE IF EXISTS `User`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `User` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `passwordHash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `firstName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `birthDate` date DEFAULT NULL,
  `role` enum('CUSTOMER','MERCHANT','ADMIN') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CUSTOMER',
  `status` enum('ACTIVE','SUSPENDED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `User`
--

LOCK TABLES `User` WRITE;
/*!40000 ALTER TABLE `User` DISABLE KEYS */;
INSERT INTO `User` VALUES (1,'admin@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Administración','Paseo',NULL,NULL,'ADMIN','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(2,'ana@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Ana','Rivas','+591 71234567',NULL,'CUSTOMER','ACTIVE','2026-07-05 19:00:00.000','2026-10-03 12:08:00.005',NULL),(3,'luis@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Luis','Pérez',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(4,'sofia@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Sofía','Méndez',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(5,'marco@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Marco','Díaz',NULL,NULL,'CUSTOMER','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(6,'camila@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Camila','Rocha',NULL,NULL,'CUSTOMER','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(7,'carla@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Carla','Quiroga',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(8,'diego@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Diego','Rojas',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(9,'andres@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Andrés','Vargas',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(10,'valeria@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Valeria','Carrasco',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(11,'jorge@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Jorge','Antezana',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(12,'paola@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Paola','Guzmán',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(13,'ricardo@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Ricardo','Pauker',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(14,'mauricio@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Mauricio','Salazar',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(15,'kenji@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Kenji','Arce',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(16,'gabriela@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Gabriela','Montaño',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(17,'daniela@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Daniela','Torrico',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(18,'fernando@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Fernando','Claure',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL),(19,'natalia@demo.paseo','$2b$10$paSfniE8p3dixms4beSEye6Xj.M/Brx4.S5smnLODOyXPmgw2i736','Natalia','Soria',NULL,NULL,'MERCHANT','ACTIVE','2026-07-05 19:00:00.000','2026-07-05 19:00:00.000',NULL);
/*!40000 ALTER TABLE `User` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('2bb29e2e-d657-4d43-86c6-e5e9ab883596','71f0c2bcc651059dfa73185fc1ed525b74a24d4eee13ab760735aa46aa95b930','2026-10-03 11:55:48.507','20261003150000_purchase_items_cancellations',NULL,NULL,'2026-10-03 11:55:47.810',1),('5cae26f9-3af1-4dd0-95cf-20e16bf0d6f5','aa61e4b342eb19c97814b108c90a8876b265ea4cc37fc21503deb83a6da49719','2026-10-02 19:43:30.508','20261002193500_init',NULL,NULL,'2026-10-02 19:43:28.475',1),('c8ca49f1-a86d-407e-adaa-ccb0d960089f','0a2a5353ccba1fbebfe508fa65cc1bebe820f8c3f54c4e14635e84d6e47e568b','2026-10-03 11:07:22.264','20261003120000_merchant_role',NULL,NULL,'2026-10-03 11:07:21.897',1),('dc133256-937e-4323-a10e-de9f4f4b6085','461006c47cab55ed2ddb31284bbc040a77958cdf38b2d069afa3c4a360adcc33','2026-10-02 22:45:44.370','20261002230000_events_badges_business_rewards',NULL,NULL,'2026-10-02 22:45:43.521',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-03 11:43:59
