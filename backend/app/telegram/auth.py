from __future__ import annotations

import json
import uuid
from typing import Any, Optional

from fastapi import HTTPException
from telethon.errors import (
    FloodWaitError,
    PhoneCodeExpiredError,
    PasswordHashInvalidError,
    PhoneCodeInvalidError,
    SessionPasswordNeededError,
)
from telethon.tl.functions.auth import ResetLoginEmailRequest
from telethon.tl.functions.account import GetPasswordRequest

from app.config import get_settings
from app.database import execute, fetchone
from app.deps import encrypt_secret, new_auth_token
from app.models import Country, ForceMethod
from app.telegram.client import drop_client, get_client, make_ephemeral_client, resolve_api_credentials
from app.telegram.floodwait import with_floodwait
from app.telegram.sessions import delete_session, secure_session_file, session_path

# Compact but practical country list (ISO + dial + flag). Clients fetch via GET /api/auth/countries.
COUNTRIES: list[Country] = [
    Country(iso="RU", name="Россия", dial_code="+7", flag="🇷🇺"),
    Country(iso="UA", name="Украина", dial_code="+380", flag="🇺🇦"),
    Country(iso="BY", name="Беларусь", dial_code="+375", flag="🇧🇾"),
    Country(iso="KZ", name="Казахстан", dial_code="+7", flag="🇰🇿"),
    Country(iso="UZ", name="Узбекистан", dial_code="+998", flag="🇺🇿"),
    Country(iso="AM", name="Армения", dial_code="+374", flag="🇦🇲"),
    Country(iso="AZ", name="Азербайджан", dial_code="+994", flag="🇦🇿"),
    Country(iso="GE", name="Грузия", dial_code="+995", flag="🇬🇪"),
    Country(iso="MD", name="Молдова", dial_code="+373", flag="🇲🇩"),
    Country(iso="KG", name="Кыргызстан", dial_code="+996", flag="🇰🇬"),
    Country(iso="TJ", name="Таджикистан", dial_code="+992", flag="🇹🇯"),
    Country(iso="TM", name="Туркменистан", dial_code="+993", flag="🇹🇲"),
    Country(iso="US", name="США", dial_code="+1", flag="🇺🇸"),
    Country(iso="CA", name="Канада", dial_code="+1", flag="🇨🇦"),
    Country(iso="GB", name="Великобритания", dial_code="+44", flag="🇬🇧"),
    Country(iso="DE", name="Германия", dial_code="+49", flag="🇩🇪"),
    Country(iso="FR", name="Франция", dial_code="+33", flag="🇫🇷"),
    Country(iso="IT", name="Италия", dial_code="+39", flag="🇮🇹"),
    Country(iso="ES", name="Испания", dial_code="+34", flag="🇪🇸"),
    Country(iso="PT", name="Португалия", dial_code="+351", flag="🇵🇹"),
    Country(iso="PL", name="Польша", dial_code="+48", flag="🇵🇱"),
    Country(iso="CZ", name="Чехия", dial_code="+420", flag="🇨🇿"),
    Country(iso="SK", name="Словакия", dial_code="+421", flag="🇸🇰"),
    Country(iso="HU", name="Венгрия", dial_code="+36", flag="🇭🇺"),
    Country(iso="RO", name="Румыния", dial_code="+40", flag="🇷🇴"),
    Country(iso="BG", name="Болгария", dial_code="+359", flag="🇧🇬"),
    Country(iso="RS", name="Сербия", dial_code="+381", flag="🇷🇸"),
    Country(iso="HR", name="Хорватия", dial_code="+385", flag="🇭🇷"),
    Country(iso="SI", name="Словения", dial_code="+386", flag="🇸🇮"),
    Country(iso="BA", name="Босния и Герцеговина", dial_code="+387", flag="🇧🇦"),
    Country(iso="ME", name="Черногория", dial_code="+382", flag="🇲🇪"),
    Country(iso="MK", name="Северная Македония", dial_code="+389", flag="🇲🇰"),
    Country(iso="AL", name="Албания", dial_code="+355", flag="🇦🇱"),
    Country(iso="GR", name="Греция", dial_code="+30", flag="🇬🇷"),
    Country(iso="TR", name="Турция", dial_code="+90", flag="🇹🇷"),
    Country(iso="CY", name="Кипр", dial_code="+357", flag="🇨🇾"),
    Country(iso="IL", name="Израиль", dial_code="+972", flag="🇮🇱"),
    Country(iso="AE", name="ОАЭ", dial_code="+971", flag="🇦🇪"),
    Country(iso="SA", name="Саудовская Аравия", dial_code="+966", flag="🇸🇦"),
    Country(iso="QA", name="Катар", dial_code="+974", flag="🇶🇦"),
    Country(iso="KW", name="Кувейт", dial_code="+965", flag="🇰🇼"),
    Country(iso="BH", name="Бахрейн", dial_code="+973", flag="🇧🇭"),
    Country(iso="OM", name="Оман", dial_code="+968", flag="🇴🇲"),
    Country(iso="EG", name="Египет", dial_code="+20", flag="🇪🇬"),
    Country(iso="MA", name="Марокко", dial_code="+212", flag="🇲🇦"),
    Country(iso="DZ", name="Алжир", dial_code="+213", flag="🇩🇿"),
    Country(iso="TN", name="Тунис", dial_code="+216", flag="🇹🇳"),
    Country(iso="ZA", name="ЮАР", dial_code="+27", flag="🇿🇦"),
    Country(iso="NG", name="Нигерия", dial_code="+234", flag="🇳🇬"),
    Country(iso="KE", name="Кения", dial_code="+254", flag="🇰🇪"),
    Country(iso="IN", name="Индия", dial_code="+91", flag="🇮🇳"),
    Country(iso="PK", name="Пакистан", dial_code="+92", flag="🇵🇰"),
    Country(iso="BD", name="Бангладеш", dial_code="+880", flag="🇧🇩"),
    Country(iso="LK", name="Шри-Ланка", dial_code="+94", flag="🇱🇰"),
    Country(iso="NP", name="Непал", dial_code="+977", flag="🇳🇵"),
    Country(iso="CN", name="Китай", dial_code="+86", flag="🇨🇳"),
    Country(iso="HK", name="Гонконг", dial_code="+852", flag="🇭🇰"),
    Country(iso="TW", name="Тайвань", dial_code="+886", flag="🇹🇼"),
    Country(iso="JP", name="Япония", dial_code="+81", flag="🇯🇵"),
    Country(iso="KR", name="Южная Корея", dial_code="+82", flag="🇰🇷"),
    Country(iso="SG", name="Сингапур", dial_code="+65", flag="🇸🇬"),
    Country(iso="MY", name="Малайзия", dial_code="+60", flag="🇲🇾"),
    Country(iso="TH", name="Таиланд", dial_code="+66", flag="🇹🇭"),
    Country(iso="VN", name="Вьетнам", dial_code="+84", flag="🇻🇳"),
    Country(iso="ID", name="Индонезия", dial_code="+62", flag="🇮🇩"),
    Country(iso="PH", name="Филиппины", dial_code="+63", flag="🇵🇭"),
    Country(iso="AU", name="Австралия", dial_code="+61", flag="🇦🇺"),
    Country(iso="NZ", name="Новая Зеландия", dial_code="+64", flag="🇳🇿"),
    Country(iso="BR", name="Бразилия", dial_code="+55", flag="🇧🇷"),
    Country(iso="AR", name="Аргентина", dial_code="+54", flag="🇦🇷"),
    Country(iso="CL", name="Чили", dial_code="+56", flag="🇨🇱"),
    Country(iso="CO", name="Колумбия", dial_code="+57", flag="🇨🇴"),
    Country(iso="MX", name="Мексика", dial_code="+52", flag="🇲🇽"),
    Country(iso="PE", name="Перу", dial_code="+51", flag="🇵🇪"),
    Country(iso="VE", name="Венесуэла", dial_code="+58", flag="🇻🇪"),
    Country(iso="NL", name="Нидерланды", dial_code="+31", flag="🇳🇱"),
    Country(iso="BE", name="Бельгия", dial_code="+32", flag="🇧🇪"),
    Country(iso="CH", name="Швейцария", dial_code="+41", flag="🇨🇭"),
    Country(iso="AT", name="Австрия", dial_code="+43", flag="🇦🇹"),
    Country(iso="SE", name="Швеция", dial_code="+46", flag="🇸🇪"),
    Country(iso="NO", name="Норвегия", dial_code="+47", flag="🇳🇴"),
    Country(iso="DK", name="Дания", dial_code="+45", flag="🇩🇰"),
    Country(iso="FI", name="Финляндия", dial_code="+358", flag="🇫🇮"),
    Country(iso="IE", name="Ирландия", dial_code="+353", flag="🇮🇪"),
    Country(iso="IS", name="Исландия", dial_code="+354", flag="🇮🇸"),
    Country(iso="LT", name="Литва", dial_code="+370", flag="🇱🇹"),
    Country(iso="LV", name="Латвия", dial_code="+371", flag="🇱🇻"),
    Country(iso="EE", name="Эстония", dial_code="+372", flag="🇪🇪"),
    Country(iso="LU", name="Люксембург", dial_code="+352", flag="🇱🇺"),
    Country(iso="MT", name="Мальта", dial_code="+356", flag="🇲🇹"),
    Country(iso="MC", name="Монако", dial_code="+377", flag="🇲🇨"),
    Country(iso="AD", name="Андорра", dial_code="+376", flag="🇦🇩"),
    Country(iso="LI", name="Лихтенштейн", dial_code="+423", flag="🇱🇮"),
    Country(iso="SM", name="Сан-Марино", dial_code="+378", flag="🇸🇲"),
    Country(iso="VA", name="Ватикан", dial_code="+379", flag="🇻🇦"),
    Country(iso="IR", name="Иран", dial_code="+98", flag="🇮🇷"),
    Country(iso="IQ", name="Ирак", dial_code="+964", flag="🇮🇶"),
    Country(iso="JO", name="Иордания", dial_code="+962", flag="🇯🇴"),
    Country(iso="LB", name="Ливан", dial_code="+961", flag="🇱🇧"),
    Country(iso="SY", name="Сирия", dial_code="+963", flag="🇸🇾"),
    Country(iso="AF", name="Афганистан", dial_code="+93", flag="🇦🇫"),
    Country(iso="MN", name="Монголия", dial_code="+976", flag="🇲🇳"),
    Country(iso="KH", name="Камбоджа", dial_code="+855", flag="🇰🇭"),
    Country(iso="LA", name="Лаос", dial_code="+856", flag="🇱🇦"),
    Country(iso="MM", name="Мьянма", dial_code="+95", flag="🇲🇲"),
    Country(iso="BN", name="Бруней", dial_code="+673", flag="🇧🇳"),
    Country(iso="FJ", name="Фиджи", dial_code="+679", flag="🇫🇯"),
    Country(iso="CU", name="Куба", dial_code="+53", flag="🇨🇺"),
    Country(iso="DO", name="Доминиканская Республика", dial_code="+1", flag="🇩🇴"),
    Country(iso="CR", name="Коста-Рика", dial_code="+506", flag="🇨🇷"),
    Country(iso="PA", name="Панама", dial_code="+507", flag="🇵🇦"),
    Country(iso="GT", name="Гватемала", dial_code="+502", flag="🇬🇹"),
    Country(iso="HN", name="Гондурас", dial_code="+504", flag="🇭🇳"),
    Country(iso="SV", name="Сальвадор", dial_code="+503", flag="🇸🇻"),
    Country(iso="NI", name="Никарагуа", dial_code="+505", flag="🇳🇮"),
    Country(iso="UY", name="Уругвай", dial_code="+598", flag="🇺🇾"),
    Country(iso="PY", name="Парагвай", dial_code="+595", flag="🇵🇾"),
    Country(iso="BO", name="Боливия", dial_code="+591", flag="🇧🇴"),
    Country(iso="EC", name="Эквадор", dial_code="+593", flag="🇪🇨"),
    Country(iso="GH", name="Гана", dial_code="+233", flag="🇬🇭"),
    Country(iso="ET", name="Эфиопия", dial_code="+251", flag="🇪🇹"),
    Country(iso="TZ", name="Танзания", dial_code="+255", flag="🇹🇿"),
    Country(iso="UG", name="Уганда", dial_code="+256", flag="🇺🇬"),
    Country(iso="SN", name="Сенегал", dial_code="+221", flag="🇸🇳"),
    Country(iso="CI", name="Кот-д’Ивуар", dial_code="+225", flag="🇨🇮"),
    Country(iso="CM", name="Камерун", dial_code="+237", flag="🇨🇲"),
    Country(iso="AO", name="Ангола", dial_code="+244", flag="🇦🇴"),
    Country(iso="MZ", name="Мозамбик", dial_code="+258", flag="🇲🇿"),
    Country(iso="ZW", name="Зимбабве", dial_code="+263", flag="🇿🇼"),
    Country(iso="BW", name="Ботсвана", dial_code="+267", flag="🇧🇼"),
    Country(iso="MU", name="Маврикий", dial_code="+230", flag="🇲🇺"),
    Country(iso="SC", name="Сейшелы", dial_code="+248", flag="🇸🇨"),
    Country(iso="MV", name="Мальдивы", dial_code="+960", flag="🇲🇻"),
    Country(iso="NP", name="Непал", dial_code="+977", flag="🇳🇵"),
    Country(iso="BT", name="Бутан", dial_code="+975", flag="🇧🇹"),
    Country(iso="MO", name="Макао", dial_code="+853", flag="🇲🇴"),
    Country(iso="KP", name="КНДР", dial_code="+850", flag="🇰🇵"),
    Country(iso="PS", name="Палестина", dial_code="+970", flag="🇵🇸"),
    Country(iso="YE", name="Йемен", dial_code="+967", flag="🇾🇪"),
    Country(iso="LY", name="Ливия", dial_code="+218", flag="🇱🇾"),
    Country(iso="SD", name="Судан", dial_code="+249", flag="🇸🇩"),
    Country(iso="SS", name="Южный Судан", dial_code="+211", flag="🇸🇸"),
    Country(iso="SO", name="Сомали", dial_code="+252", flag="🇸🇴"),
    Country(iso="DJ", name="Джибути", dial_code="+253", flag="🇩🇯"),
    Country(iso="ER", name="Эритрея", dial_code="+291", flag="🇪🇷"),
    Country(iso="RW", name="Руанда", dial_code="+250", flag="🇷🇼"),
    Country(iso="BI", name="Бурунди", dial_code="+257", flag="🇧🇮"),
    Country(iso="MW", name="Малави", dial_code="+265", flag="🇲🇼"),
    Country(iso="ZM", name="Замбия", dial_code="+260", flag="🇿🇲"),
    Country(iso="NA", name="Намибия", dial_code="+264", flag="🇳🇦"),
    Country(iso="LS", name="Лесото", dial_code="+266", flag="🇱🇸"),
    Country(iso="SZ", name="Эсватини", dial_code="+268", flag="🇸🇿"),
    Country(iso="MG", name="Мадагаскар", dial_code="+261", flag="🇲🇬"),
    Country(iso="RE", name="Реюньон", dial_code="+262", flag="🇷🇪"),
    Country(iso="YT", name="Майотта", dial_code="+262", flag="🇾🇹"),
    Country(iso="GP", name="Гваделупа", dial_code="+590", flag="🇬🇵"),
    Country(iso="MQ", name="Мартиника", dial_code="+596", flag="🇲🇶"),
    Country(iso="GF", name="Французская Гвиана", dial_code="+594", flag="🇬🇫"),
    Country(iso="PF", name="Французская Полинезия", dial_code="+689", flag="🇵🇫"),
    Country(iso="NC", name="Новая Каледония", dial_code="+687", flag="🇳🇨"),
    Country(iso="WS", name="Самоа", dial_code="+685", flag="🇼🇸"),
    Country(iso="TO", name="Тонга", dial_code="+676", flag="🇹🇴"),
    Country(iso="PG", name="Папуа — Новая Гвинея", dial_code="+675", flag="🇵🇬"),
    Country(iso="SB", name="Соломоновы Острова", dial_code="+677", flag="🇸🇧"),
    Country(iso="VU", name="Вануату", dial_code="+678", flag="🇻🇺"),
    Country(iso="GU", name="Гуам", dial_code="+1", flag="🇬🇺"),
    Country(iso="MP", name="Северные Марианские Острова", dial_code="+1", flag="🇲🇵"),
    Country(iso="AS", name="Американское Самоа", dial_code="+1", flag="🇦🇸"),
    Country(iso="PR", name="Пуэрто-Рико", dial_code="+1", flag="🇵🇷"),
    Country(iso="VI", name="Виргинские Острова (США)", dial_code="+1", flag="🇻🇮"),
    Country(iso="JM", name="Ямайка", dial_code="+1", flag="🇯🇲"),
    Country(iso="TT", name="Тринидад и Тобаго", dial_code="+1", flag="🇹🇹"),
    Country(iso="BB", name="Барбадос", dial_code="+1", flag="🇧🇧"),
    Country(iso="BS", name="Багамы", dial_code="+1", flag="🇧🇸"),
    Country(iso="BZ", name="Белиз", dial_code="+501", flag="🇧🇿"),
    Country(iso="GY", name="Гайана", dial_code="+592", flag="🇬🇾"),
    Country(iso="SR", name="Суринам", dial_code="+597", flag="🇸🇷"),
    Country(iso="HT", name="Гаити", dial_code="+509", flag="🇭🇹"),
    Country(iso="IS", name="Исландия", dial_code="+354", flag="🇮🇸"),
    Country(iso="FO", name="Фарерские острова", dial_code="+298", flag="🇫🇴"),
    Country(iso="GL", name="Гренландия", dial_code="+299", flag="🇬🇱"),
    Country(iso="AX", name="Аландские острова", dial_code="+358", flag="🇦🇽"),
    Country(iso="XK", name="Косово", dial_code="+383", flag="🇽🇰"),
    Country(iso="GI", name="Гибралтар", dial_code="+350", flag="🇬🇮"),
    Country(iso="JE", name="Джерси", dial_code="+44", flag="🇯🇪"),
    Country(iso="GG", name="Гернси", dial_code="+44", flag="🇬🇬"),
    Country(iso="IM", name="Остров Мэн", dial_code="+44", flag="🇮🇲"),
]


def list_countries() -> list[Country]:
    # Deduplicate by iso keeping first
    seen: set[str] = set()
    out: list[Country] = []
    for c in COUNTRIES:
        if c.iso in seen:
            continue
        seen.add(c.iso)
        out.append(c)
    return sorted(out, key=lambda x: x.name)


async def register_key(api_id: int, api_hash: str, phone_hint: str = "") -> dict[str, Any]:
    settings = get_settings()
    if not settings.allow_per_account_keys:
        raise HTTPException(400, "Per-account ключи отключены")
    account_id = str(uuid.uuid4())
    token = new_auth_token()
    await execute(
        """
        INSERT INTO accounts (id, phone, name, auth_state, api_id_enc, api_hash_enc, token)
        VALUES (?, ?, '', 'pending', ?, ?, ?)
        """,
        (
            account_id,
            phone_hint or "",
            encrypt_secret(str(api_id)),
            encrypt_secret(api_hash),
            token,
        ),
    )
    return {"account_id": account_id, "token": token}


async def send_code(
    phone: str,
    force_method: Optional[ForceMethod] = None,
    account: Optional[dict] = None,
    api_id: Optional[int] = None,
    api_hash: Optional[str] = None,
    device_id: str = "default",
) -> dict[str, Any]:
    settings = get_settings()
    reused_existing_account = False
    if account is None:
        existing = await fetchone("SELECT * FROM accounts WHERE phone = ? AND auth_state = 'ok' ORDER BY created_at LIMIT 1", (phone,))
        if existing:
            account = dict(existing)
            reused_existing_account = True
    account_id = account["id"] if account else str(uuid.uuid4())
    if settings.allow_per_account_keys and api_id and api_hash and not account:
        creds = (api_id, api_hash)
    elif account:
        creds = resolve_api_credentials(account)
    else:
        creds = resolve_api_credentials(None)

    preferences = await fetchone("SELECT hide_device_type FROM account_preferences WHERE account_id = ?", (account_id,))
    hide_device_type = bool(preferences["hide_device_type"]) if preferences else False
    client = make_ephemeral_client(account_id, creds[0], creds[1], device_id, hide_device_type)
    await client.connect()
    try:
        kwargs: dict[str, Any] = {}
        if force_method == ForceMethod.sms:
            kwargs["force_sms"] = True
        # call/telegram forced via Telethon code settings when available
        result = await with_floodwait(lambda: client.send_code_request(phone, **kwargs))
        if not account:
            token = new_auth_token()
            api_id_enc = api_hash_enc = None
            if settings.allow_per_account_keys and api_id and api_hash:
                api_id_enc = encrypt_secret(str(api_id))
                api_hash_enc = encrypt_secret(api_hash)
            await execute(
                """
                INSERT INTO accounts (id, phone, name, auth_state, api_id_enc, api_hash_enc, token)
                VALUES (?, ?, '', 'pending', ?, ?, ?)
                """,
                (account_id, phone, api_id_enc, api_hash_enc, token),
            )
        else:
            await execute("UPDATE accounts SET phone = ? WHERE id = ?", (phone, account_id))
            token = None if reused_existing_account else account["token"]

        secure_session_file(session_path(account_id, device_id))
        return {
            "account_id": account_id,
            "phone": phone,
            "phone_code_hash": result.phone_code_hash,
            "token": token,
            "timeout": 60,
        }
    except FloodWaitError as e:
        raise HTTPException(
            429,
            f"Слишком много попыток. Подождите {e.seconds} секунд.",
            headers={"Retry-After": str(e.seconds)},
        )
    except Exception as e:
        from telethon.errors import RPCError

        if isinstance(e, RPCError):
            raise HTTPException(400, _auth_error_message(e)) from e
        raise
    finally:
        await client.disconnect()


async def sign_in(
    phone: str,
    phone_code_hash: str,
    code: str,
    password: Optional[str] = None,
    account_id: Optional[str] = None,
    device_id: str = "default",
) -> dict[str, Any]:
    row = None
    if account_id:
        row = await fetchone("SELECT * FROM accounts WHERE id = ?", (account_id,))
    if not row:
        row = await fetchone("SELECT * FROM accounts WHERE phone = ? ORDER BY created_at DESC", (phone,))
    if not row:
        raise HTTPException(400, "Сначала запросите код")

    account = dict(row)
    client = await get_client(account["id"], account, device_id)
    try:
        try:
            me = await with_floodwait(
                lambda: client.sign_in(phone=phone, code=code, phone_code_hash=phone_code_hash)
            )
        except SessionPasswordNeededError:
            if not password:
                return {
                    "need_password": True,
                    "account_id": account["id"],
                    "token": account["token"],
                }
            try:
                me = await with_floodwait(lambda: client.sign_in(password=password))
            except PasswordHashInvalidError:
                raise HTTPException(400, "Неверный пароль. Попробуйте ещё раз.")
            except FloodWaitError as e:
                raise HTTPException(
                    429,
                    f"Слишком много попыток. Подождите {e.seconds} секунд.",
                    headers={"Retry-After": str(e.seconds)},
                )
            except Exception as e:
                from telethon.errors import RPCError

                if isinstance(e, RPCError):
                    raise HTTPException(400, _auth_error_message(e)) from e
                raise
        except PhoneCodeInvalidError:
            raise HTTPException(400, "Неверный код. Попробуйте ещё раз.")
        except PhoneCodeExpiredError:
            raise HTTPException(400, "Срок действия кода истёк. Запросите новый код.")
        except FloodWaitError as e:
            raise HTTPException(
                429,
                f"Слишком много попыток. Подождите {e.seconds} секунд.",
                headers={"Retry-After": str(e.seconds)},
            )
        except Exception as e:
            from telethon.errors import RPCError

            if isinstance(e, RPCError):
                raise HTTPException(400, _auth_error_message(e)) from e
            raise

        name = " ".join(filter(None, [getattr(me, "first_name", None), getattr(me, "last_name", None)])).strip()
        username = getattr(me, "username", None)
        await execute(
            """
            UPDATE accounts
            SET name = ?, username = ?, auth_state = 'ok', phone = ?, last_sync = datetime('now')
            WHERE id = ?
            """,
            (name or phone, username, phone, account["id"]),
        )
        safe_device_id = "".join(c for c in device_id if c.isalnum() or c in "-_")[:80] or "default"
        await execute("INSERT OR IGNORE INTO account_devices (account_id, device_id) VALUES (?, ?)", (account["id"], safe_device_id))
        secure_session_file(session_path(account["id"], device_id))
        return {
            "need_password": False,
            "account_id": account["id"],
            "token": account["token"],
            "name": name,
            "username": username,
        }
    finally:
        pass


def _auth_error_message(error: Exception) -> str:
    """Translate common Telegram RPC auth errors into actionable Russian text."""
    code = getattr(error, "message", "") or str(error)
    normalized = code.upper()
    if "PHONE_NUMBER_INVALID" in normalized:
        return "Номер телефона указан неверно. Проверьте номер и попробуйте снова."
    if "PHONE_NUMBER_BANNED" in normalized:
        return "Этот номер телефона заблокирован Telegram."
    if "PHONE_CODE_INVALID" in normalized:
        return "Неверный код. Проверьте его и попробуйте ещё раз."
    if "PHONE_CODE_EXPIRED" in normalized:
        return "Срок действия кода истёк. Запросите новый код."
    if "PHONE_CODE_EMPTY" in normalized:
        return "Введите код подтверждения из Telegram."
    if "PASSWORD_HASH_INVALID" in normalized:
        return "Неверный пароль двухэтапной проверки. Попробуйте ещё раз."
    return "Telegram не принял запрос авторизации. Проверьте данные и попробуйте позже."


async def start_qr(account: Optional[dict] = None) -> dict[str, Any]:
    settings = get_settings()
    account_id = account["id"] if account else str(uuid.uuid4())
    if account:
        api_id, api_hash = resolve_api_credentials(account)
        token = account["token"]
    else:
        api_id, api_hash = resolve_api_credentials(None)
        token = new_auth_token()
        await execute(
            "INSERT INTO accounts (id, phone, name, auth_state, token) VALUES (?, '', '', 'pending', ?)",
            (account_id, token),
        )

    preferences = await fetchone("SELECT hide_device_type FROM account_preferences WHERE account_id = ?", (account_id,))
    hide_device_type = bool(preferences["hide_device_type"]) if preferences else False
    client = make_ephemeral_client(account_id, api_id, api_hash, hide_device_type=hide_device_type)
    await client.connect()
    qr = await client.qr_login()
    # Keep client in memory briefly via get_client path
    from app.telegram.client import _clients

    _clients[account_id] = client
    return {
        "account_id": account_id,
        "token": token,
        "url": qr.url,
        "expires": 60,
    }


async def check_qr(account_id: str) -> dict[str, Any]:
    from app.telegram.client import _clients

    client = _clients.get(account_id)
    if not client:
        raise HTTPException(400, "QR-сессия не найдена")
    try:
        me = await client.qr_login().wait(timeout=2)
    except Exception:
        return {"status": "pending"}
    if not me:
        return {"status": "pending"}
    name = " ".join(filter(None, [getattr(me, "first_name", None), getattr(me, "last_name", None)])).strip()
    await execute(
        "UPDATE accounts SET name = ?, username = ?, auth_state = 'ok', last_sync = datetime('now') WHERE id = ?",
        (name, getattr(me, "username", None), account_id),
    )
    row = await fetchone("SELECT token FROM accounts WHERE id = ?", (account_id,))
    return {"status": "ok", "token": row["token"] if row else None, "name": name}


async def logout(account: dict, purge_cache: bool = False) -> None:
    try:
        client = await get_client(account["id"], account)
        await with_floodwait(lambda: client.log_out())
    except Exception:
        pass
    await drop_client(account["id"])
    delete_session(account["id"])
    await execute("UPDATE accounts SET auth_state = 'dead', token = NULL WHERE id = ?", (account["id"],))
    if purge_cache:
        from app.cache.manager import purge_account_cache

        await purge_account_cache(account["id"])


async def recover_password(phone: str) -> dict[str, Any]:
    row = await fetchone("SELECT * FROM accounts WHERE phone = ? ORDER BY created_at DESC", (phone,))
    if not row:
        raise HTTPException(400, "Аккаунт не найден")
    account = dict(row)
    client = await get_client(account["id"], account)
    try:
        pwd = await client(GetPasswordRequest())
        if not getattr(pwd, "has_recovery", False):
            return {
                "has_recovery": False,
                "faq_url": "https://telegram.org/faq#q-i-forgot-my-2-step-verification-password",
            }
        # Initiate email recovery if available
        try:
            await client.send_code_request(phone)
        except Exception:
            pass
        return {"has_recovery": True, "hint": getattr(pwd, "hint", None)}
    except Exception:
        return {
            "has_recovery": False,
            "faq_url": "https://telegram.org/faq#q-i-forgot-my-2-step-verification-password",
        }
